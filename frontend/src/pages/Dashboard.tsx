import React, { useState, useEffect } from 'react';
import type { SystemMetrics, User } from '../types';
import { wsClient } from '../services/ws';
import type { ConnectionStatus } from '../services/ws';
import { Navbar } from '../components/Navbar';
import { CpuCard } from '../components/CpuCard';
import { MemoryCard } from '../components/MemoryCard';
import { DiskCard } from '../components/DiskCard';
import { NetworkCard } from '../components/NetworkCard';
import { ProcessTable } from '../components/ProcessTable';
import { DockerContainersCard } from '../components/DockerContainersCard';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { Activity, ShieldCheck, HardDrive, Cpu, Layers, Box, Terminal, LayoutDashboard } from 'lucide-react';
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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'docker' | 'processes'>('overview');

  useEffect(() => {
    // Start WebSocket
    wsClient.connect();

    const unsubMetrics = wsClient.onMetrics((data, latency) => {
      setMetrics(data);
      setLatencyMs(latency);

      // Update CPU history
      setCpuHistory((prev) => {
        const next = [...prev, data.cpu.overall_percent];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });

      // Update Memory history
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

  const runningContainersCount = metrics?.docker?.running_count ?? 0;
  const totalContainersCount = metrics?.docker?.containers_count ?? 0;

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col select-none">
      {/* Top Navigation */}
      <Navbar
        user={user}
        host={metrics?.host || null}
        wsStatus={wsStatus}
        latencyMs={latencyMs}
        onLogout={onLogout}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Genel Bakış (Overview)</span>
            </button>

            <button
              onClick={() => setActiveTab('docker')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer relative ${
                activeTab === 'docker'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>Docker Konteynerleri</span>
              {totalContainersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-400/20 text-cyan-300 font-mono">
                  {runningContainersCount}/{totalContainersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('processes')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'processes'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Süreçler (Processes)</span>
              {metrics && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                  {metrics.processes.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Host Badge */}
          {metrics && (
            <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800">
              <span>Sunucu: <strong className="text-slate-200">{metrics.host.hostname}</strong></span>
              <span>•</span>
              <span>OS: <strong className="text-slate-200">{metrics.host.platform}</strong></span>
            </div>
          )}
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Quick CPU */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">CPU Yükü</span>
                <span className="text-xl font-bold font-mono text-cyan-300">
                  {metrics ? `${metrics.cpu.overall_percent}%` : '--'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:block">
              {metrics?.cpu.logical_cores || 0} Çekirdek
            </span>
          </div>

          {/* Quick RAM */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">RAM</span>
                <span className="text-xl font-bold font-mono text-violet-300">
                  {metrics ? `${metrics.memory.used_percent}%` : '--'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:block">
              {metrics ? formatBytes(metrics.memory.used) : '--'}
            </span>
          </div>

          {/* Quick Primary Disk */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Kök Disk (/)</span>
                <span className="text-xl font-bold font-mono text-amber-300">
                  {metrics && metrics.disks.length > 0 ? `${metrics.disks[0].used_percent}%` : '--'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:block">
              {metrics && metrics.disks.length > 0 ? formatBytes(metrics.disks[0].free) + ' Boş' : '--'}
            </span>
          </div>

          {/* Quick Network */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Ağ Trafiği</span>
                <span className="text-xl font-bold font-mono text-emerald-300">
                  {metrics ? formatSpeed(metrics.network.reduce((a, b) => a + b.speed_recv_per_sec, 0)) : '--'}
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:block">
              {metrics?.network.length || 0} Arayüz
            </span>
          </div>

          {/* Quick Docker Container summary */}
          <div
            onClick={() => setActiveTab('docker')}
            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-cyan-500/40 transition-colors col-span-2 sm:col-span-1"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Docker</span>
                <span className="text-xl font-bold font-mono text-blue-300">
                  {runningContainersCount}
                  <span className="text-xs font-normal text-slate-400">/{totalContainersCount}</span>
                </span>
              </div>
            </div>
            <span className="text-[11px] text-cyan-400 font-medium">Gör &rarr;</span>
          </div>
        </div>

        {/* Loading State Skeleton if metrics not arrived yet */}
        {!metrics ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <h3 className="text-base font-semibold text-slate-200">Sunucu Verileri Yükleniyor...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Ubuntu ana makinesine ait telemetri akışı başlatılıyor.
            </p>
          </div>
        ) : (
          <>
            {/* VIEW 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Core Metrics: CPU and RAM */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CpuCard cpu={metrics.cpu} history={cpuHistory} />
                  <MemoryCard memory={metrics.memory} history={memHistory} />
                </div>

                {/* Storage and Network */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DiskCard disks={metrics.disks} diskIO={metrics.disk_io} />
                  <NetworkCard network={metrics.network} />
                </div>

                {/* Docker Containers Card */}
                <DockerContainersCard docker={metrics.docker} />

                {/* Top Running Processes */}
                <ProcessTable processes={metrics.processes} />
              </div>
            )}

            {/* VIEW 2: DOCKER ONLY */}
            {activeTab === 'docker' && (
              <div className="space-y-6">
                <DockerContainersCard docker={metrics.docker} />
              </div>
            )}

            {/* VIEW 3: PROCESSES ONLY */}
            {activeTab === 'processes' && (
              <div className="space-y-6">
                <ProcessTable processes={metrics.processes} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer Info */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/40 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span>Sentinel Server Monitor • Docker Container Telemetry</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>Çekirdek: {metrics?.host.kernel_version || 'Linux'}</span>
            <span>•</span>
            <span>Mimari: {metrics?.host.architecture || 'x86_64'}</span>
          </div>
        </div>
      </footer>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
