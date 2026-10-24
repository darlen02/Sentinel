import React from 'react';
import {
  Sun,
  Moon,
  Activity,
  WifiOff,
  Key,
  LogOut,
  Menu,
} from 'lucide-react';
import type { User, HostInfo } from '../types';
import type { ConnectionStatus } from '../services/ws';

interface HeaderProps {
  user: User;
  host: HostInfo | null;
  wsStatus: ConnectionStatus;
  latencyMs: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenPasswordModal: () => void;
  onOpenMobileSidebar: () => void;
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  host,
  wsStatus,
  latencyMs,
  isDark,
  onToggleTheme,
  onLogout,
  onOpenPasswordModal,
  onOpenMobileSidebar,
  pageTitle,
}) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'YÖNETİCİ',
          classes:
            'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
        };
      case 'operator':
        return {
          label: 'OPERATÖR',
          classes:
            'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
        };
      default:
        return {
          label: 'İZLEYİCİ',
          classes:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
        };
    }
  };

  const roleInfo = getRoleBadge(user.role);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 transition-colors select-none">
      {/* Left: Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger button for mobile */}
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Menüyü Aç"
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
          {pageTitle}
        </h1>

        {host && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
            <span>{host.hostname}</span>
          </span>
        )}
      </div>

      {/* Right: Actions, Theme, Status, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Live Stream Telemetry Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shrink-0">
          {wsStatus === 'connected' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] sm:text-[11px] tracking-wide">
                CANLI
              </span>
              {/* Latency: hidden on small screens; clock skew graceful handling */}
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px] hidden sm:inline">
                {latencyMs > 5000 ? 'Aktif' : `${latencyMs}ms`}
              </span>
            </>
          ) : wsStatus === 'connecting' ? (
            <>
              <Activity className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-[11px]">Bağlanıyor...</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
              <span className="text-red-600 dark:text-red-400 text-[10px] sm:text-[11px]">Koptu</span>
            </>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Password change (Desktop only) */}
        <button
          onClick={onOpenPasswordModal}
          title="Parola Değiştir"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <Key className="w-3.5 h-3.5 text-amber-500" />
          <span>Şifre</span>
        </button>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1 hidden sm:block"></div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-0.5 sm:pl-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {user.username}
            </span>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border w-fit ${roleInfo.classes}`}
            >
              {roleInfo.label}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          title="Oturumu Kapat"
          className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
