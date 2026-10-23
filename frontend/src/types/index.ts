export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
  last_login?: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  role: UserRole;
}


export interface HostInfo {
  hostname: string;
  os: string;
  platform: string;
  platform_version: string;
  kernel_version: string;
  architecture: string;
  uptime_seconds: number;
  uptime_formatted: string;
  procs_count: number;
  boot_time: number;
}

export interface CpuInfo {
  overall_percent: number;
  cores_percent: number[];
  model_name: string;
  mhz: number;
  logical_cores: number;
  physical_cores: number;
  load_1: number;
  load_5: number;
  load_15: number;
}

export interface MemoryInfo {
  total: number;
  available: number;
  used: number;
  free: number;
  used_percent: number;
  swap_total: number;
  swap_used: number;
  swap_free: number;
  swap_used_percent: number;
}

export interface DiskPartition {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;
  free: number;
  used: number;
  used_percent: number;
}

export interface DiskIOInfo {
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
}

export interface NetInterfaceInfo {
  name: string;
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  speed_recv_per_sec: number;
  speed_sent_per_sec: number;
}

export interface ProcessItem {
  pid: number;
  name: string;
  username: string;
  cpu_percent: number;
  memory_percent: number;
  memory_bytes: number;
  status: string;
  create_time: number;
  cmdline?: string;
}

export interface DockerPort {
  ip?: string;
  private_port: number;
  public_port?: number;
  type: string;
}

export interface DockerContainer {
  id: string;
  names: string[];
  image: string;
  image_id: string;
  command: string;
  created: number;
  state: string;
  status: string;
  ports: DockerPort[];
}

export interface DockerSummary {
  available: boolean;
  error?: string;
  containers_count: number;
  running_count: number;
  paused_count: number;
  stopped_count: number;
  containers: DockerContainer[];
}

export interface SystemMetrics {
  timestamp: number;
  host: HostInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskPartition[];
  disk_io: DiskIOInfo;
  network: NetInterfaceInfo[];
  processes: ProcessItem[];
  docker: DockerSummary;
}

export interface MetricHistoryPoint {
  timestamp: number;
  cpu_percent: number;
  cpu_max: number;
  memory_percent: number;
  memory_used: number;
  disk_used_percent: number;
  net_recv_speed: number;
  net_sent_speed: number;
  load_1: number;
  containers_running: number;
}

export interface MetricHistorySummary {
  avg_cpu: number;
  max_cpu: number;
  avg_memory: number;
  max_memory: number;
  avg_disk: number;
  total_net_recv_bytes: number;
  total_net_sent_bytes: number;
  max_load: number;
}

export interface MetricsHistoryResponse {
  range: string;
  count: number;
  summary: MetricHistorySummary;
  data: MetricHistoryPoint[];
}

