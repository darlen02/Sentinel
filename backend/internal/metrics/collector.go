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

	// Process cache & UID mapping
	lastProcCheck   time.Time
	cachedProcesses []models.ProcessItem
	uidCache        map[string]string

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

func (c *Collector) Collect() (*models.SystemMetrics, error) {
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

	// 2. CPU
	overallPercent, err := cpu.Percent(0, false)
	if err == nil && len(overallPercent) > 0 {
		metrics.CPU.OverallPercent = math.Round(overallPercent[0]*10) / 10
	}

	coresPercent, err := cpu.Percent(0, true)
	if err == nil {
		for i, p := range coresPercent {
			coresPercent[i] = math.Round(p*10) / 10
		}
		metrics.CPU.CoresPercent = coresPercent
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

	// 4. Disks
	hostRoot := os.Getenv("HOST_ROOT")
	partitions, err := disk.Partitions(false)
	seenMounts := make(map[string]bool)

	if err == nil {
		for _, p := range partitions {
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

	// 6. Top Processes (High performance candidate sorting & lazy enrichment)
	metrics.Processes = c.collectTopProcesses()

	// 7. Docker Containers Telemetry
	metrics.Docker = c.dockerClient.GetSummary()

	c.lastCheckTime = now
	return metrics, nil
}

func (c *Collector) collectTopProcesses() []models.ProcessItem {
	now := time.Now()
	// Refresh full process list every 3 seconds to eliminate high /proc disk scanning overhead
	if len(c.cachedProcesses) > 0 && now.Sub(c.lastProcCheck) < 3*time.Second {
		return c.cachedProcesses
	}
	c.lastProcCheck = now

	procs, err := process.Processes()
	if err != nil {
		return c.cachedProcesses
	}

	type procCandidate struct {
		proc *process.Process
		pid  int32
		name string
		cpuP float64
		memP float32
	}

	candidates := make([]procCandidate, 0, len(procs))
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		cpuP, _ := p.CPUPercent()
		memP, _ := p.MemoryPercent()

		candidates = append(candidates, procCandidate{
			proc: p,
			pid:  p.Pid,
			name: name,
			cpuP: cpuP,
			memP: memP,
		})
	}

	// Sort candidates by CPU% descending, then Memory%
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].cpuP != candidates[j].cpuP {
			return candidates[i].cpuP > candidates[j].cpuP
		}
		return candidates[i].memP > candidates[j].memP
	})

	// Only enrich the TOP 50 displayed processes (reduces syscall overhead by >85%)
	limit := 50
	if len(candidates) < limit {
		limit = len(candidates)
	}

	items := make([]models.ProcessItem, 0, limit)
	for i := 0; i < limit; i++ {
		cand := candidates[i]
		p := cand.proc

		var memBytes uint64
		if memInfo, err := p.MemoryInfo(); err == nil && memInfo != nil {
			memBytes = memInfo.RSS
		}

		statusSlice, _ := p.Status()
		status := "running"
		if len(statusSlice) > 0 {
			status = statusSlice[0]
		}

		createTime, _ := p.CreateTime()
		cmdline, _ := p.Cmdline()
		if len(cmdline) > 200 {
			cmdline = cmdline[:197] + "..."
		}

		items = append(items, models.ProcessItem{
			PID:           cand.pid,
			Name:          cand.name,
			Username:      c.getUsername(p),
			CPUPercent:    math.Round(cand.cpuP*10) / 10,
			MemoryPercent: float32(math.Round(float64(cand.memP)*10) / 10),
			MemoryBytes:   memBytes,
			Status:        status,
			CreateTime:    createTime,
			Cmdline:       cmdline,
		})
	}

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
