package metrics

import (
	"fmt"
	"math"
	"os"
	"sort"
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

	// Previous counters for rate calculation
	prevNetIO   map[string]net.IOCountersStat
	prevDiskIO  disk.IOCountersStat
	hasPrevDisk bool
}

func NewCollector() *Collector {
	return &Collector{
		dockerClient: docker.NewClient(),
		prevNetIO:    make(map[string]net.IOCountersStat),
	}
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

	// 1. Host Info
	if hInfo, err := host.Info(); err == nil {
		metrics.Host = models.HostInfo{
			Hostname:        hInfo.Hostname,
			OS:              hInfo.OS,
			Platform:        hInfo.Platform,
			PlatformVersion: hInfo.PlatformVersion,
			KernelVersion:   hInfo.KernelVersion,
			Architecture:    hInfo.KernelArch,
			UptimeSeconds:   hInfo.Uptime,
			UptimeFormatted: formatUptime(hInfo.Uptime),
			ProcsCount:      hInfo.Procs,
			BootTime:        hInfo.BootTime,
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

	cpuInfos, err := cpu.Info()
	if err == nil && len(cpuInfos) > 0 {
		metrics.CPU.ModelName = cpuInfos[0].ModelName
		metrics.CPU.Mhz = math.Round(cpuInfos[0].Mhz)
	}

	logicalCores, _ := cpu.Counts(true)
	physicalCores, _ := cpu.Counts(false)
	metrics.CPU.LogicalCores = logicalCores
	metrics.CPU.PhysicalCores = physicalCores

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
			// Skip pseudofs or duplicates
			if p.Fstype == "squashfs" || p.Fstype == "tmpfs" || p.Fstype == "overlay" && hostRoot != "" {
				continue
			}
			if seenMounts[p.Mountpoint] {
				continue
			}
			u, err := disk.Usage(p.Mountpoint)
			if err != nil || u.Total == 0 {
				continue
			}
			seenMounts[p.Mountpoint] = true
			metrics.Disks = append(metrics.Disks, models.DiskPartition{
				Device:      p.Device,
				Mountpoint:  p.Mountpoint,
				Fstype:      p.Fstype,
				Total:       u.Total,
				Free:        u.Free,
				Used:        u.Used,
				UsedPercent: math.Round(u.UsedPercent*10) / 10,
			})
		}
	}

	// If running in docker with HOST_ROOT mounted (e.g., /host/root)
	if hostRoot != "" {
		if u, err := disk.Usage(hostRoot); err == nil && u.Total > 0 {
			// Prepend host root as primary "/"
			hostDisk := models.DiskPartition{
				Device:      "Host Root Disk",
				Mountpoint:  "/",
				Fstype:      u.Fstype,
				Total:       u.Total,
				Free:        u.Free,
				Used:        u.Used,
				UsedPercent: math.Round(u.UsedPercent*10) / 10,
			}
			// Replace or prepend
			metrics.Disks = append([]models.DiskPartition{hostDisk}, metrics.Disks...)
		}
	}

	// Fallback if no disk found (e.g. initial container test)
	if len(metrics.Disks) == 0 {
		if u, err := disk.Usage("/"); err == nil {
			metrics.Disks = append(metrics.Disks, models.DiskPartition{
				Device:      "root",
				Mountpoint:  "/",
				Fstype:      u.Fstype,
				Total:       u.Total,
				Free:        u.Free,
				Used:        u.Used,
				UsedPercent: math.Round(u.UsedPercent*10) / 10,
			})
		}
	}

	// Disk IO speed
	if diskIOCounters, err := disk.IOCounters(); err == nil {
		var totalReadBytes, totalWriteBytes uint64
		for _, io := range diskIOCounters {
			totalReadBytes += io.ReadBytes
			totalWriteBytes += io.WriteBytes
		}

		if c.hasPrevDisk && timeDelta > 0 {
			if totalReadBytes >= c.prevDiskIO.ReadBytes {
				metrics.DiskIO.ReadBytesPerSec = uint64(float64(totalReadBytes-c.prevDiskIO.ReadBytes) / timeDelta)
			}
			if totalWriteBytes >= c.prevDiskIO.WriteBytes {
				metrics.DiskIO.WriteBytesPerSec = uint64(float64(totalWriteBytes-c.prevDiskIO.WriteBytes) / timeDelta)
			}
		}
		c.prevDiskIO = disk.IOCountersStat{
			ReadBytes:  totalReadBytes,
			WriteBytes: totalWriteBytes,
		}
		c.hasPrevDisk = true
	}

	// 5. Network
	if netIOCounters, err := net.IOCounters(true); err == nil {
		newPrevNetIO := make(map[string]net.IOCountersStat)
		for _, nic := range netIOCounters {
			// Skip loopback if multiple interfaces exist
			if nic.Name == "lo" && len(netIOCounters) > 1 {
				continue
			}

			var speedRecv, speedSent uint64
			if prev, ok := c.prevNetIO[nic.Name]; ok && timeDelta > 0 {
				if nic.BytesRecv >= prev.BytesRecv {
					speedRecv = uint64(float64(nic.BytesRecv-prev.BytesRecv) / timeDelta)
				}
				if nic.BytesSent >= prev.BytesSent {
					speedSent = uint64(float64(nic.BytesSent-prev.BytesSent) / timeDelta)
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

	// 6. Top Processes
	metrics.Processes = c.collectTopProcesses()

	// 7. Docker Containers Telemetry
	metrics.Docker = c.dockerClient.GetSummary()

	c.lastCheckTime = now
	return metrics, nil
}

func (c *Collector) collectTopProcesses() []models.ProcessItem {
	procs, err := process.Processes()
	if err != nil {
		return nil
	}

	items := make([]models.ProcessItem, 0, len(procs))
	for _, p := range procs {
		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		cpuP, _ := p.CPUPercent()
		memP, _ := p.MemoryPercent()
		username, _ := p.Username()
		statusSlice, _ := p.Status()
		status := "running"
		if len(statusSlice) > 0 {
			status = statusSlice[0]
		}

		var memBytes uint64
		if memInfo, err := p.MemoryInfo(); err == nil && memInfo != nil {
			memBytes = memInfo.RSS
		}
		createTime, _ := p.CreateTime()
		cmdline, _ := p.Cmdline()
		if len(cmdline) > 200 {
			cmdline = cmdline[:197] + "..."
		}

		items = append(items, models.ProcessItem{
			PID:           p.Pid,
			Name:          name,
			Username:      username,
			CPUPercent:    math.Round(cpuP*10) / 10,
			MemoryPercent: float32(math.Round(float64(memP)*10) / 10),
			MemoryBytes:   memBytes,
			Status:        status,
			CreateTime:    createTime,
			Cmdline:       cmdline,
		})
	}

	// Sort by CPU% descending, then Memory%
	sort.Slice(items, func(i, j int) bool {
		if items[i].CPUPercent != items[j].CPUPercent {
			return items[i].CPUPercent > items[j].CPUPercent
		}
		return items[i].MemoryPercent > items[j].MemoryPercent
	})

	// Limit to top 50 processes
	if len(items) > 50 {
		items = items[:50]
	}

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

