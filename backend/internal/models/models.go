package models

import "time"

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	LastLogin    *time.Time `json:"last_login,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required,oneof=admin operator viewer"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin operator viewer"`
}


type HostInfo struct {
	Hostname        string `json:"hostname"`
	OS              string `json:"os"`
	Platform        string `json:"platform"`
	PlatformVersion string `json:"platform_version"`
	KernelVersion   string `json:"kernel_version"`
	Architecture    string `json:"architecture"`
	UptimeSeconds   uint64 `json:"uptime_seconds"`
	UptimeFormatted string `json:"uptime_formatted"`
	ProcsCount      uint64 `json:"procs_count"`
	BootTime        uint64 `json:"boot_time"`
}

type CpuInfo struct {
	OverallPercent float64   `json:"overall_percent"`
	CoresPercent   []float64 `json:"cores_percent"`
	ModelName      string    `json:"model_name"`
	Mhz            float64   `json:"mhz"`
	LogicalCores   int       `json:"logical_cores"`
	PhysicalCores  int       `json:"physical_cores"`
	Load1          float64   `json:"load_1"`
	Load5          float64   `json:"load_5"`
	Load15         float64   `json:"load_15"`
}

type MemoryInfo struct {
	Total           uint64  `json:"total"`
	Available       uint64  `json:"available"`
	Used            uint64  `json:"used"`
	Free            uint64  `json:"free"`
	UsedPercent     float64 `json:"used_percent"`
	SwapTotal       uint64  `json:"swap_total"`
	SwapUsed        uint64  `json:"swap_used"`
	SwapFree        uint64  `json:"swap_free"`
	SwapUsedPercent float64 `json:"swap_used_percent"`
}

type DiskPartition struct {
	Device      string  `json:"device"`
	Mountpoint  string  `json:"mountpoint"`
	Fstype      string  `json:"fstype"`
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type DiskIOInfo struct {
	ReadBytesPerSec  uint64 `json:"read_bytes_per_sec"`
	WriteBytesPerSec uint64 `json:"write_bytes_per_sec"`
}

type NetInterfaceInfo struct {
	Name            string `json:"name"`
	BytesSent       uint64 `json:"bytes_sent"`
	BytesRecv       uint64 `json:"bytes_recv"`
	PacketsSent     uint64 `json:"packets_sent"`
	PacketsRecv     uint64 `json:"packets_recv"`
	SpeedRecvPerSec uint64 `json:"speed_recv_per_sec"`
	SpeedSentPerSec uint64 `json:"speed_sent_per_sec"`
}

type ProcessItem struct {
	PID           int32   `json:"pid"`
	Name          string  `json:"name"`
	Username      string  `json:"username"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float32 `json:"memory_percent"`
	MemoryBytes   uint64  `json:"memory_bytes"`
	Status        string  `json:"status"`
	CreateTime    int64   `json:"create_time"`
	Cmdline       string  `json:"cmdline"`
}

type DockerPort struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort uint16 `json:"private_port"`
	PublicPort  uint16 `json:"public_port,omitempty"`
	Type        string `json:"type"`
}

type DockerContainer struct {
	ID      string       `json:"id"`
	Names   []string     `json:"names"`
	Image   string       `json:"image"`
	ImageID string       `json:"image_id"`
	Command string       `json:"command"`
	Created int64        `json:"created"`
	State   string       `json:"state"`
	Status  string       `json:"status"`
	Ports   []DockerPort `json:"ports"`
}

type DockerSummary struct {
	Available       bool              `json:"available"`
	Error           string            `json:"error,omitempty"`
	ContainersCount int               `json:"containers_count"`
	RunningCount    int               `json:"running_count"`
	PausedCount     int               `json:"paused_count"`
	StoppedCount    int               `json:"stopped_count"`
	Containers      []DockerContainer `json:"containers"`
}

type SystemMetrics struct {
	Timestamp int64              `json:"timestamp"`
	Host      HostInfo           `json:"host"`
	CPU       CpuInfo            `json:"cpu"`
	Memory    MemoryInfo         `json:"memory"`
	Disks     []DiskPartition    `json:"disks"`
	DiskIO    DiskIOInfo         `json:"disk_io"`
	Network   []NetInterfaceInfo `json:"network"`
	Processes []ProcessItem      `json:"processes"`
	Docker    DockerSummary      `json:"docker"`
}
