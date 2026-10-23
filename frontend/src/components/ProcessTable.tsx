import React, { useState, useMemo } from 'react';
import { Terminal, Search, Trash2, AlertCircle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import type { ProcessItem, UserRole } from '../types';
import { formatBytes } from '../utils/format';
import { api } from '../services/api';

interface ProcessTableProps {
  processes: ProcessItem[];
  userRole?: UserRole;
}

export const ProcessTable: React.FC<ProcessTableProps> = ({ processes, userRole }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [expandedPid, setExpandedPid] = useState<number | null>(null);
  const [killLoading, setKillLoading] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const canKill = userRole !== 'viewer';

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleKill = async (pid: number, name: string) => {
    if (!canKill) {
      showNotification('Görüntüleyici yetkisi ile süreç sonlandırılamaz', 'error');
      return;
    }

    if (!window.confirm(`"${name}" (PID: ${pid}) sürecini sonlandırmak istediğinize emin misiniz?`)) {
      return;
    }

    setKillLoading(pid);
    try {
      const res = await api.killProcess(pid);
      showNotification(res.message || `Süreç (PID: ${pid}) sonlandırıldı`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'Süreç sonlandırılamadı', 'error');
    } finally {
      setKillLoading(null);
    }
  };

  const filteredProcesses = useMemo(() => {
    return processes
      .filter((p) => {
        const query = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.pid.toString().includes(query) ||
          (p.username && p.username.toLowerCase().includes(query)) ||
          (p.cmdline && p.cmdline.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'cpu') return b.cpu_percent - a.cpu_percent;
        if (sortBy === 'mem') return b.memory_percent - a.memory_percent;
        return a.pid - b.pid;
      });
  }, [processes, search, sortBy]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-500/10 border border-pink-200 dark:border-pink-500/20 text-pink-600 dark:text-pink-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Çalışan Süreçler (Processes)
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                (Toplam {processes.length} Takip Edilen)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gerçek Zamanlı Süreç İzleme & Kaynak Tüketim Analizi
            </p>
          </div>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Süreç adı, PID veya komut..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Sort Buttons */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setSortBy('cpu')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortBy === 'cpu'
                  ? 'bg-white dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              CPU %
            </button>
            <button
              onClick={() => setSortBy('mem')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortBy === 'mem'
                  ? 'bg-white dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              RAM %
            </button>
            <button
              onClick={() => setSortBy('pid')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortBy === 'pid'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              PID
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              <th className="py-2.5 px-3 w-8"></th>
              <th className="py-2.5 px-3">PID</th>
              <th className="py-2.5 px-3">Süreç Adı</th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Kullanıcı</th>
              <th className="py-2.5 px-3 text-right">CPU %</th>
              <th className="py-2.5 px-3 text-right">RAM %</th>
              <th className="py-2.5 px-3 text-right">Bellek (RSS)</th>
              <th className="py-2.5 px-3 text-center hidden md:table-cell">Durum</th>
              <th className="py-2.5 px-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredProcesses.length > 0 ? (
              filteredProcesses.map((p) => {
                const isExpanded = expandedPid === p.pid;
                const isKilling = killLoading === p.pid;

                return (
                  <React.Fragment key={p.pid}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors font-mono">
                      {/* Expand Toggle */}
                      <td className="py-2.5 px-2 text-center">
                        {p.cmdline ? (
                          <button
                            onClick={() => setExpandedPid(isExpanded ? null : p.pid)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0.5"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : null}
                      </td>

                      {/* PID */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{p.pid}</td>

                      {/* Name */}
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={p.name}>
                        {p.name}
                      </td>

                      {/* User */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{p.username || 'system'}</td>

                      {/* CPU % */}
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-semibold ${
                            p.cpu_percent >= 40
                              ? 'text-red-500 dark:text-red-400'
                              : p.cpu_percent >= 10
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {p.cpu_percent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Memory % */}
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-semibold ${
                            p.memory_percent >= 30
                              ? 'text-violet-600 dark:text-violet-400'
                              : p.memory_percent >= 10
                              ? 'text-indigo-600 dark:text-indigo-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {p.memory_percent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Memory RSS */}
                      <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 font-sans">
                        {formatBytes(p.memory_bytes)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center hidden md:table-cell">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize font-sans border border-slate-200 dark:border-slate-700">
                          {p.status}
                        </span>
                      </td>

                      {/* Kill Action */}
                      <td className="py-2.5 px-3 text-right font-sans">
                        {canKill ? (
                          <button
                            onClick={() => handleKill(p.pid, p.name)}
                            disabled={isKilling}
                            title="Süreci Sonlandır (SIGKILL)"
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400" title="Salt okunur erişim">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Command Details */}
                    {isExpanded && p.cmdline && (
                      <tr className="bg-slate-50 dark:bg-slate-950/60 font-mono text-[11px]">
                        <td colSpan={9} className="py-2.5 px-6 border-b border-slate-200 dark:border-slate-800/80">
                          <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold shrink-0">Komut:</span>
                            <span className="break-all text-slate-800 dark:text-slate-300 select-all">{p.cmdline}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 font-sans">
                  Aramaya uygun süreç bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
