package metrics

import (
	"fmt"
	"math"
	"os"
	"os/user"
	"sort"
	"strconv"
	"sync"
	"time"

	"sentinel/internal/docker"
	"sentinel/internal/models"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

const (
	// processScanInterval is the minimum time between full /proc process scans.
	// Scanning every process is the single most expensive operation in the collector.
	processScanInterval = 5 * time.Second

	// topProcessLimit is the number of processes that are enriched and sent to clients.
	topProcessLimit = 50

	// partitionCacheTTL is how long the mount table is cached (it rarely changes).
	partitionCacheTTL = 60 * time.Second
)

// procStatic holds slow-changing per-process attributes so they are not
// re-read from /proc on every scan.
type procStatic struct {
	name       string
	username   string
	cmdline    string
	createTime int64
}

type Collector struct {
	mu            sync.Mutex
	lastCheckTime time.Time
	dockerClient  *docker.Client

	// Static host info cache (avoid repeated syscalls on immutable data)
	cachedHostInfo  *host.InfoStat
	cachedCPUModel  string
	cachedCPUMhz    float64
	logicalCores    int
	physicalCores   int
	lastStaticCheck time.Time

	// Disk partition (mount table) cache
	cachedPartitions []disk.PartitionStat
	lastPartCheck    time.Time

	// Process cache & UID mapping
	lastProcCheck   time.Time
	cachedProcesses []models.ProcessItem
	uidCache        map[string]string
	prevProcCPU     map[int32]float64    // pid -> cumulative CPU seconds at previous scan
	procStatic      map[int32]procStatic // pid -> cached name/user/cmdline/create time
	memTotal        uint64

	// Most recent full snapshot (lets the recorder reuse live data instead of re-collecting)
	lastFull   *models.SystemMetrics
	lastFullAt time.Time

	// Previous counters for rate calculation
	prevNetIO   map[string]net.IOCountersStat
	prevDiskIO  disk.IOCountersStat
	hasPrevDisk bool
}

func NewCollector() *Collector {
	return &Collector{
		dockerClient: docker.NewClient(),
		prevNetIO:    make(map[string]net.IOCountersStat),
		uidCache:     make(map[string]string),
		prevProcCPU:  make(map[int32]float64),
		procStatic:   make(map[int32]procStatic),
	}
}

func (c *Collector) getUsername(p *process.Process) string {
	uids, err := p.Uids()
	if err == nil && len(uids) > 0 {
		uidStr := strconv.Itoa(int(uids[0]))
		if name, ok := c.uidCache[uidStr]; ok {
			return name
		}
		if u, err := user.LookupId(uidStr); err == nil && u != nil {
			c.uidCache[uidStr] = u.Username
			return u.Username
		}
		c.uidCache[uidStr] = uidStr
		return uidStr
	}
	if name, err := p.Username(); err == nil && name != "" {
		return name
	}
	return "system"
}

// Collect gathers a full snapshot, including per-core CPU and the process table.
func (c *Collector) Collect() (*models.SystemMetrics, error) {
	return c.collect(true)
}

// CollectLite gathers only the data needed for historical recording
// (no per-core CPU, no process table scan).
func (c *Collector) CollectLite() (*models.SystemMetrics, error) {
	return c.collect(false)
}

// Latest returns the most recent full snapshot if it is younger than maxAge, otherwise nil.
func (c *Collector) Latest(maxAge time.Duration) *models.SystemMetrics {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.lastFull != nil && time.Since(c.lastFullAt) <= maxAge {
		return c.lastFull
	}
	return nil
}

func (c *Collector) collect(full bool) (*models.SystemMetrics, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	var timeDelta float64 = 1.0
	if !c.lastCheckTime.IsZero() {
		timeDelta = now.Sub(c.lastCheckTime).Seconds()
		if timeDelta <= 0 {
			timeDelta = 1.0
		}
	}

	metrics := &models.SystemMetrics{
		Timestamp: now.UnixMilli(),
	}

	// 1. Host Info (Cached static attributes for 5 minutes)
	if c.cachedHostInfo == nil || now.Sub(c.lastStaticCheck) > 5*time.Minute {
		if hInfo, err := host.Info(); err == nil {
			c.cachedHostInfo = hInfo
		}
		if cpuInfos, err := cpu.Info(); err == nil && len(cpuInfos) > 0 {
			c.cachedCPUModel = cpuInfos[0].ModelName
			c.cachedCPUMhz = math.Round(cpuInfos[0].Mhz)
		}
		c.logicalCores, _ = cpu.Counts(true)
		c.physicalCores, _ = cpu.Counts(false)
		c.lastStaticCheck = now
	}

	if c.cachedHostInfo != nil {
		uptime, _ := host.Uptime()
		if uptime == 0 {
			uptime = c.cachedHostInfo.Uptime
		}
		metrics.Host = models.HostInfo{
			Hostname:        c.cachedHostInfo.Hostname,
			OS:              c.cachedHostInfo.OS,
			Platform:        c.cachedHostInfo.Platform,
			PlatformVersion: c.cachedHostInfo.PlatformVersion,
			KernelVersion:   c.cachedHostInfo.KernelVersion,
			Architecture:    c.cachedHostInfo.KernelArch,
			UptimeSeconds:   uptime,
			UptimeFormatted: formatUptime(uptime),
			ProcsCount:      c.cachedHostInfo.Procs,
			BootTime:        c.cachedHostInfo.BootTime,
		}
	}

	// 2. CPU (a single per-core read; the overall figure is derived from it)
	coresPercent, err := cpu.Percent(0, true)
	if err == nil && len(coresPercent) > 0 {
		var sum float64
		for i, p := range coresPercent {
			sum += p
			coresPercent[i] = math.Round(p*10) / 10
		}
		metrics.CPU.OverallPercent = math.Round(sum/float64(len(coresPercent))*10) / 10
		if full {
			metrics.CPU.CoresPercent = coresPercent
		}
	}

	metrics.CPU.ModelName = c.cachedCPUModel
	metrics.CPU.Mhz = c.cachedCPUMhz
	metrics.CPU.LogicalCores = c.logicalCores
	metrics.CPU.PhysicalCores = c.physicalCores

	if l, err := load.Avg(); err == nil && l != nil {
		metrics.CPU.Load1 = math.Round(l.Load1*100) / 100
		metrics.CPU.Load5 = math.Round(l.Load5*100) / 100
		metrics.CPU.Load15 = math.Round(l.Load15*100) / 100
	}

	// 3. Memory
	if vMem, err := mem.VirtualMemory(); err == nil {
		c.memTotal = vMem.Total
		metrics.Memory = models.MemoryInfo{
			Total:       vMem.Total,
			Available:   vMem.Available,
			Used:        vMem.Used,
			Free:        vMem.Free,
			UsedPercent: math.Round(vMem.UsedPercent*10) / 10,
		}
	}

	if sMem, err := mem.SwapMemory(); err == nil {
		metrics.Memory.SwapTotal = sMem.Total
		metrics.Memory.SwapUsed = sMem.Used
		metrics.Memory.SwapFree = sMem.Free
		metrics.Memory.SwapUsedPercent = math.Round(sMem.UsedPercent*10) / 10
	}

	// 4. Disks (the mount table is cached; usage is re-read on every sample)
	hostRoot := os.Getenv("HOST_ROOT")
	if c.cachedPartitions == nil || now.Sub(c.lastPartCheck) > partitionCacheTTL {
		if parts, perr := disk.Partitions(false); perr == nil {
			c.cachedPartitions = parts
			c.lastPartCheck = now
		}
	}
	seenMounts := make(map[string]bool)

	if len(c.cachedPartitions) > 0 {
		for _, p := range c.cachedPartitions {
			if seenMounts[p.Mountpoint] {
				continue
			}

			// In Docker container, host root is mounted at hostRoot
			checkPath := p.Mountpoint
			if hostRoot != "" && p.Mountpoint == "/" {
				checkPath = hostRoot
			}

			usage, err := disk.Usage(checkPath)
			if err != nil {
				continue
			}

			seenMounts[p.Mountpoint] = true
			metrics.Disks = append(metrics.Disks, models.DiskPartition{
				Device:      p.Device,
				Mountpoint:  p.Mountpoint,
				Fstype:      p.Fstype,
				Total:       usage.Total,
				Free:        usage.Free,
				Used:        usage.Used,
				UsedPercent: math.Round(usage.UsedPercent*10) / 10,
			})
		}
	}

	// Disk IO Rate
	if diskIOCounters, err := disk.IOCounters(); err == nil {
		var totalReadBytes, totalWriteBytes uint64
		for _, io := range diskIOCounters {
			totalReadBytes += io.ReadBytes
			totalWriteBytes += io.WriteBytes
		}

		currentIO := disk.IOCountersStat{
			ReadBytes:  totalReadBytes,
			WriteBytes: totalWriteBytes,
		}

		if c.hasPrevDisk && timeDelta > 0 {
			var readDelta, writeDelta uint64
			if currentIO.ReadBytes >= c.prevDiskIO.ReadBytes {
				readDelta = currentIO.ReadBytes - c.prevDiskIO.ReadBytes
			}
			if currentIO.WriteBytes >= c.prevDiskIO.WriteBytes {
				writeDelta = currentIO.WriteBytes - c.prevDiskIO.WriteBytes
			}

			metrics.DiskIO = models.DiskIOInfo{
				ReadBytesPerSec:  uint64(float64(readDelta) / timeDelta),
				WriteBytesPerSec: uint64(float64(writeDelta) / timeDelta),
			}
		}
		c.prevDiskIO = currentIO
		c.hasPrevDisk = true
	}

	// 5. Network Interfaces & Traffic Rates
	if netCounters, err := net.IOCounters(true); err == nil {
		newPrevNetIO := make(map[string]net.IOCountersStat)

		for _, nic := range netCounters {
			if nic.Name == "lo" {
				continue
			}

			var speedRecv, speedSent uint64
			if prevNic, ok := c.prevNetIO[nic.Name]; ok && timeDelta > 0 {
				if nic.BytesRecv >= prevNic.BytesRecv {
					speedRecv = uint64(float64(nic.BytesRecv-prevNic.BytesRecv) / timeDelta)
				}
				if nic.BytesSent >= prevNic.BytesSent {
					speedSent = uint64(float64(nic.BytesSent-prevNic.BytesSent) / timeDelta)
				}
			}

			newPrevNetIO[nic.Name] = nic
			metrics.Network = append(metrics.Network, models.NetInterfaceInfo{
				Name:            nic.Name,
				BytesSent:       nic.BytesSent,
				BytesRecv:       nic.BytesRecv,
				PacketsSent:     nic.PacketsSent,
				PacketsRecv:     nic.PacketsRecv,
				SpeedRecvPerSec: speedRecv,
				SpeedSentPerSec: speedSent,
			})
		}
		c.prevNetIO = newPrevNetIO
	}

	// 6. Top Processes (only for full snapshots; the recorder never needs them)
	if full {
		metrics.Processes = c.collectTopProcesses()
	}

	// 7. Docker Containers Telemetry
	metrics.Docker = c.dockerClient.GetSummary()

	c.lastCheckTime = now
	if full {
		c.lastFull = metrics
		c.lastFullAt = now
	}
	return metrics, nil
}

// collectTopProcesses scans /proc at most every processScanInterval.
//
// Cost model per scan: two /proc reads per process (stat for CPU times, statm
// for RSS). CPU% is computed from the delta of cumulative CPU time since the
// previous scan, which is both cheaper and more accurate than gopsutil's
// CPUPercent (a lifetime average that also re-reads the start time every call).
// Slow-changing attributes (name, user, cmdline, start time) are cached for the
// processes that stay in the top list.
func (c *Collector) collectTopProcesses() []models.ProcessItem {
	now := time.Now()
	if len(c.cachedProcesses) > 0 && now.Sub(c.lastProcCheck) < processScanInterval {
		return c.cachedProcesses
	}

	procs, err := process.Processes()
	if err != nil {
		return c.cachedProcesses
	}

	elapsed := now.Sub(c.lastProcCheck).Seconds()
	havePrev := len(c.prevProcCPU) > 0 && elapsed > 0
	c.lastProcCheck = now

	type procCandidate struct {
		proc *process.Process
		cpuP float64
		rss  uint64
	}

	candidates := make([]procCandidate, 0, len(procs))
	newPrev := make(map[int32]float64, len(procs))

	for _, p := range procs {
		times, err := p.Times()
		if err != nil || times == nil {
			continue
		}
		used := times.User + times.System
		newPrev[p.Pid] = used

		var cpuP float64
		if havePrev {
			if prev, ok := c.prevProcCPU[p.Pid]; ok && used >= prev {
				cpuP = (used - prev) / elapsed * 100
			}
		}

		var rss uint64
		if memInfo, err := p.MemoryInfo(); err == nil && memInfo != nil {
			rss = memInfo.RSS
		}

		candidates = append(candidates, procCandidate{
			proc: p,
			cpuP: cpuP,
			rss:  rss,
		})
	}
	c.prevProcCPU = newPrev

	// Sort candidates by CPU% descending, then resident memory
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].cpuP != candidates[j].cpuP {
			return candidates[i].cpuP > candidates[j].cpuP
		}
		return candidates[i].rss > candidates[j].rss
	})

	memTotal := float64(c.memTotal)
	items := make([]models.ProcessItem, 0, topProcessLimit)
	newStatic := make(map[int32]procStatic, topProcessLimit)

	// Only the top processes are enriched (reduces syscall overhead by >85%)
	for _, cand := range candidates {
		if len(items) >= topProcessLimit {
			break
		}
		p := cand.proc

		info, ok := c.procStatic[p.Pid]
		if !ok {
			name, err := p.Name()
			if err != nil || name == "" {
				continue
			}
			createTime, _ := p.CreateTime()
			cmdline, _ := p.Cmdline()
			if len(cmdline) > 200 {
				cmdline = cmdline[:197] + "..."
			}
			info = procStatic{
				name:       name,
				username:   c.getUsername(p),
				cmdline:    cmdline,
				createTime: createTime,
			}
		}
		newStatic[p.Pid] = info

		status := "running"
		if statusSlice, _ := p.Status(); len(statusSlice) > 0 {
			status = statusSlice[0]
		}

		var memP float64
		if memTotal > 0 {
			memP = float64(cand.rss) / memTotal * 100
		}

		items = append(items, models.ProcessItem{
			PID:           p.Pid,
			Name:          info.name,
			Username:      info.username,
			CPUPercent:    math.Round(cand.cpuP*10) / 10,
			MemoryPercent: float32(math.Round(memP*10) / 10),
			MemoryBytes:   cand.rss,
			Status:        status,
			CreateTime:    info.createTime,
			Cmdline:       info.cmdline,
		})
	}

	c.procStatic = newStatic
	c.cachedProcesses = items
	return items
}

func formatUptime(uptimeSeconds uint64) string {
	days := uptimeSeconds / (24 * 3600)
	hours := (uptimeSeconds % (24 * 3600)) / 3600
	minutes := (uptimeSeconds % 3600) / 60
	seconds := uptimeSeconds % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm %ds", hours, minutes, seconds)
	}
	return fmt.Sprintf("%dm %ds", minutes, seconds)
}

func (c *Collector) GetDockerClient() *docker.Client {
	return c.dockerClient
}

func KillProcess(pid int32) error {
	p, err := process.NewProcess(pid)
	if err != nil {
		return fmt.Errorf("süreç bulunamadı (PID: %d): %w", pid, err)
	}
	return p.Kill()
}
