import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Box,
  Terminal,
  HardDrive,
  Network,
  Users,
  Server,
  Shield,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { HostInfo, SystemMetrics, User } from '../types';

export type TabKey = 'overview' | 'analytics' | 'docker' | 'processes' | 'storage' | 'network' | 'users' | 'server-info';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  metrics: SystemMetrics | null;
  currentUser: User;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  metrics,
  currentUser,
}) => {
  const host: HostInfo | null = metrics?.host || null;
  const runningContainers = metrics?.docker?.running_count ?? 0;
  const totalContainers = metrics?.docker?.containers_count ?? 0;
  const procsCount = metrics?.processes?.length ?? 0;

  const menuItems = [
    {
      id: 'overview' as TabKey,
      label: 'Genel Bakış',
      icon: LayoutDashboard,
      badge: null,
      desc: 'Sistem Kaynak Özeti',
    },
    {
      id: 'analytics' as TabKey,
      label: 'Geçmiş & Analiz',
      icon: LineChart,
      badge: 'Geçmiş',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      desc: 'Zaman Serisi Trendleri',
    },
    {
      id: 'docker' as TabKey,
      label: 'Docker Konteynerleri',
      icon: Box,
      badge: totalContainers > 0 ? `${runningContainers}/${totalContainers}` : null,
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      desc: 'Aktif Konteyner Yönetimi',
    },
    {
      id: 'processes' as TabKey,
      label: 'Süreç Yöneticisi',
      icon: Terminal,
      badge: procsCount > 0 ? `${procsCount}` : null,
      badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
      desc: 'CPU & RAM Süreçleri',
    },
    {
      id: 'storage' as TabKey,
      label: 'Depolama & Diskler',
      icon: HardDrive,
      badge: metrics?.disks?.[0] ? `${metrics.disks[0].used_percent}%` : null,
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      desc: 'Bölümler ve Disk I/O',
    },
    {
      id: 'network' as TabKey,
      label: 'Ağ & Trafik',
      icon: Network,
      badge: metrics?.network?.length ? `${metrics.network.length} Arayüz` : null,
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      desc: 'Bant Genişliği & RX/TX',
    },
    {
      id: 'users' as TabKey,
      label: 'Kullanıcı & Yetkiler',
      icon: Users,
      badge: currentUser.role === 'admin' ? 'Admin' : 'Gözlem',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      desc: 'Rol ve Hesap Yönetimi',
    },
    {
      id: 'server-info' as TabKey,
      label: 'Sunucu Bilgisi',
      icon: Server,
      badge: host ? host.os : null,
      badgeColor: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      desc: 'Kernel & Donanım Özellikleri',
    },
  ];

  return (
    <aside
      className={`relative z-30 flex flex-col shrink-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-md shadow-indigo-500/20 text-white shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-wider text-slate-900 dark:text-slate-100 font-mono">
                  SENTINEL
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  v2.0
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Sunucu Yönetim Paneli
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? `${item.label} (${item.desc})` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold shadow-xs border border-blue-200/80 dark:border-blue-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="truncate">
                    <span className="text-xs truncate block">{item.label}</span>
                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate block">
                      {item.desc}
                    </span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shrink-0 ml-1.5 ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: Host Status Card */}
      {!collapsed && host && (
        <div className="p-3 m-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {host.hostname}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {host.architecture}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {host.platform} {host.platform_version}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/80 dark:border-slate-800">
            <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
            <span className="font-mono">{host.uptime_formatted}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
