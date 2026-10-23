import React from 'react';
import { Shield, Activity, Clock, Server, LogOut, Key, WifiOff } from 'lucide-react';
import type { User, HostInfo } from '../types';
import type { ConnectionStatus } from '../services/ws';

interface NavbarProps {
  user: User | null;
  host: HostInfo | null;
  wsStatus: ConnectionStatus;
  latencyMs: number;
  onLogout: () => void;
  onOpenPasswordModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  host,
  wsStatus,
  latencyMs,
  onLogout,
  onOpenPasswordModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Branding & Host Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/20 text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-100 tracking-wide font-mono">SENTINEL</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300 font-medium">{host?.hostname || 'Sunucu'}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 truncate max-w-[140px] sm:max-w-none">
                {host ? `${host.platform} ${host.platform_version}` : 'Ubuntu Linux'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Telemetry Indicator & Uptime */}
        <div className="hidden md:flex items-center gap-4">
          {/* WS Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
            {wsStatus === 'connected' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-medium">CANLI AKIŞ</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400 font-mono">{latencyMs}ms</span>
              </>
            ) : wsStatus === 'connecting' ? (
              <>
                <Activity className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400">Bağlanıyor...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400">Bağlantı Kesildi</span>
              </>
            )}
          </div>

          {/* Uptime */}
          {host?.uptime_formatted && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Çalışma Süresi:</span>
              <span className="font-mono text-cyan-300 font-semibold">{host.uptime_formatted}</span>
            </div>
          )}
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPasswordModal}
            title="Parola Değiştir"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Şifre Değiştir</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-800 mx-1 hidden sm:block"></div>

          <div className="flex items-center gap-2 pl-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-xs text-cyan-400">
              {user?.username?.slice(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-medium text-slate-200">{user?.username || 'admin'}</div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider">{user?.role || 'admin'}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Oturumu Kapat"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
