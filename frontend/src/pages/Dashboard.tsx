import React, { useState, useEffect } from 'react';
import type { SystemMetrics, User } from '../types';
import { wsClient } from '../services/ws';
import type { ConnectionStatus } from '../services/ws';
import { Sidebar } from '../components/Sidebar';
import type { TabKey } from '../components/Sidebar';
import { Header } from '../components/Header';
import { CpuCard } from '../components/CpuCard';
import { MemoryCard } from '../components/MemoryCard';
import { DiskCard } from '../components/DiskCard';
import { NetworkCard } from '../components/NetworkCard';
import { ProcessTable } from '../components/ProcessTable';
import { DockerContainersCard } from '../components/DockerContainersCard';
import { UsersManagement } from './UsersManagement';
import { HistoricalAnalytics } from './HistoricalAnalytics';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import {
  Activity,
  Cpu,
  Layers,
  HardDrive,
  Box,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { formatBytes, formatSpeed } from '../utils/format';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const MAX_HISTORY = 30;

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState(0);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Theme Management (Default: Light Theme as requested by user)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('sentinel_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sentinel_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sentinel_theme', 'light');
    }
  }, [isDark]);

  const handleToggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  useEffect(() => {
    wsClient.connect();

    const unsubMetrics = wsClient.onMetrics((data, latency) => {
      setMetrics(data);
      setLatencyMs(latency);

      setCpuHistory((prev) => {
        const next = [...prev, data.cpu.overall_percent];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });

      setMemHistory((prev) => {
        const next = [...prev, data.memory.used_percent];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
    });

    const unsubStatus = wsClient.onStatus((status) => {
      setWsStatus(status);
    });

    return () => {
      unsubMetrics();
      unsubStatus();
      wsClient.disconnect();
    };
  }, []);

  const getPageTitle = (tab: TabKey) => {
    switch (tab) {
      case 'overview':
        return 'Sistem Genel Bakış & Performans';
      case 'analytics':
        return 'Geçmiş Metrik Trendleri & Analiz';
      case 'docker':
        return 'Docker Konteyner Yönetimi';
      case 'processes':
        return 'Süreç & İş Parçacığı Yöneticisi';
      case 'storage':
        return 'Disk Depolama & Bölümleme';
      case 'network':
        return 'Ağ Arayüzleri & Bant Genişliği';
      case 'users':
        return 'Kullanıcı ve Yetki Yönetimi (RBAC)';
      case 'server-info':
        return 'Sunucu Donanım & Çekirdek Özellikleri';
      default:
        return 'Sentinel Yönetim Paneli';
    }
  };

  const runningContainersCount = metrics?.docker?.running_count ?? 0;
  const totalContainersCount = metrics?.docker?.containers_count ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#070a11] text-slate-900 dark:text-slate-100 select-none transition-colors">
      {/* Left Vertical Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        metrics={metrics}
        currentUser={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Navbar */}
        <Header
          user={user}
          host={metrics?.host || null}
          wsStatus={wsStatus}
          latencyMs={latencyMs}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onLogout={onLogout}
          onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
          pageTitle={getPageTitle(activeTab)}
        />

        {/* Scrollable Dashboard Body (Spreads fluidly across widescreen) */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Quick Metrics KPI Banner (Always visible for at-a-glance health) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1: CPU */}
            <div
              onClick={() => setActiveTab('overview')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-cyan-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">CPU Yükü</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-cyan-300">
                    {metrics ? `${metrics.cpu.overall_percent}%` : '--'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:block">
                {metrics?.cpu.logical_cores || 0} Çekirdek
              </span>
            </div>

            {/* KPI 2: RAM */}
            <div
              onClick={() => setActiveTab('overview')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-violet-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">RAM</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-violet-300">
                    {metrics ? `${metrics.memory.used_percent}%` : '--'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:block">
                {metrics ? formatBytes(metrics.memory.used) : '--'}
              </span>
            </div>

            {/* KPI 3: Storage */}
            <div
              onClick={() => setActiveTab('storage')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-amber-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Kök Disk (/)</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-amber-300">
                    {metrics && metrics.disks.length > 0 ? `${metrics.disks[0].used_percent}%` : '--'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:block">
                {metrics && metrics.disks.length > 0 ? formatBytes(metrics.disks[0].free) + ' Boş' : '--'}
              </span>
            </div>

            {/* KPI 4: Network */}
            <div
              onClick={() => setActiveTab('network')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-emerald-500/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Ağ Trafiği</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-emerald-300">
                    {metrics ? formatSpeed(metrics.network.reduce((a, b) => a + b.speed_recv_per_sec, 0)) : '--'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:block">
                {metrics?.network.length || 0} Arayüz
              </span>
            </div>

            {/* KPI 5: Docker Containers */}
            <div
              onClick={() => setActiveTab('docker')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-blue-500/50 transition-all cursor-pointer col-span-2 sm:col-span-1"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Docker</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-blue-300">
                    {runningContainersCount}
                    <span className="text-xs font-normal text-slate-400">/{totalContainersCount}</span>
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Yönet &rarr;</span>
            </div>
          </div>

          {/* Fallback skeleton state while waiting for initial metrics */}
          {!metrics ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center flex flex-col items-center justify-center shadow-xs">
              <Activity className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Sunucu Telemetrisi Başlatılıyor...</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Ubuntu ana makinesine ait anlık metrikler toplanıyor.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW (Full System Dashboard) */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* CPU and RAM Cards */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <CpuCard cpu={metrics.cpu} history={cpuHistory} />
                    <MemoryCard memory={metrics.memory} history={memHistory} />
                  </div>

                  {/* Disk and Network Cards */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <DiskCard disks={metrics.disks} diskIO={metrics.disk_io} />
                    <NetworkCard network={metrics.network} />
                  </div>

                  {/* Docker Containers */}
                  <DockerContainersCard docker={metrics.docker} userRole={user.role} />

                  {/* Process Table */}
                  <ProcessTable processes={metrics.processes} userRole={user.role} />
                </div>
              )}

              {/* TAB: HISTORICAL ANALYTICS */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <HistoricalAnalytics />
                </div>
              )}

              {/* TAB 2: DOCKER CONTAINERS ONLY */}
              {activeTab === 'docker' && (
                <div className="space-y-6">
                  <DockerContainersCard docker={metrics.docker} userRole={user.role} />
                </div>
              )}

              {/* TAB 3: PROCESSES ONLY */}
              {activeTab === 'processes' && (
                <div className="space-y-6">
                  <ProcessTable processes={metrics.processes} userRole={user.role} />
                </div>
              )}

              {/* TAB 4: STORAGE ONLY */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <DiskCard disks={metrics.disks} diskIO={metrics.disk_io} />
                </div>
              )}

              {/* TAB 5: NETWORK ONLY */}
              {activeTab === 'network' && (
                <div className="space-y-6">
                  <NetworkCard network={metrics.network} />
                </div>
              )}

              {/* TAB 6: USER & RBAC PERMISSION MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <UsersManagement currentUser={user} />
                </div>
              )}

              {/* TAB 7: SERVER & HARDWARE INFO */}
              {activeTab === 'server-info' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs dark:shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400">
                        <Server className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Sunucu Donanım & Sistem Detayları
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ubuntu ana makine işletim sistemi özellikleri, çekirdek ve donanım konfigürasyonu
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Hostname */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sunucu Adı (Hostname)</span>
                        <span className="text-base font-semibold font-mono text-slate-800 dark:text-slate-200">
                          {metrics.host.hostname}
                        </span>
                      </div>

                      {/* OS & Version */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">İşletim Sistemi (OS)</span>
                        <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                          {metrics.host.platform} {metrics.host.platform_version} ({metrics.host.os})
                        </span>
                      </div>

                      {/* Kernel Version */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Linux Kernel Sürümü</span>
                        <span className="text-base font-semibold font-mono text-cyan-600 dark:text-cyan-400">
                          {metrics.host.kernel_version}
                        </span>
                      </div>

                      {/* Architecture */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sistem Mimarisi</span>
                        <span className="text-base font-semibold font-mono text-slate-800 dark:text-slate-200">
                          {metrics.host.architecture}
                        </span>
                      </div>

                      {/* Uptime */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Kesintisiz Çalışma Süresi (Uptime)</span>
                        <span className="text-base font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                          {metrics.host.uptime_formatted}
                        </span>
                      </div>

                      {/* CPU Model */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">İşlemci Modeli</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block" title={metrics.cpu.model_name}>
                          {metrics.cpu.model_name || 'Bilinmiyor'}
                        </span>
                      </div>

                      {/* CPU Cores */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">İşlemci Çekirdek Sayısı</span>
                        <span className="text-base font-semibold font-mono text-slate-800 dark:text-slate-200">
                          {metrics.cpu.logical_cores} Mantıksal ({metrics.cpu.physical_cores} Fiziksel)
                        </span>
                      </div>

                      {/* Physical RAM */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Toplam Fiziksel RAM</span>
                        <span className="text-base font-semibold font-mono text-violet-600 dark:text-violet-400">
                          {formatBytes(metrics.memory.total)}
                        </span>
                      </div>

                      {/* Swap Size */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Swap (Takas Alanı)</span>
                        <span className="text-base font-semibold font-mono text-amber-600 dark:text-amber-400">
                          {formatBytes(metrics.memory.swap_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Bar */}
          <footer className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Sentinel Kurumsal Sunucu Yönetim & Canlı Telemetri Paneli</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>Port: 28475</span>
              <span>•</span>
              <span>Host: {metrics?.host.hostname || 'ubuntu'}</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Password Change Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
