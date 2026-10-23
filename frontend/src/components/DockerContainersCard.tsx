import React, { useState, useMemo } from 'react';
import { Box, Play, Square, RotateCw, Search, AlertTriangle, Layers, ExternalLink, CheckCircle2 } from 'lucide-react';
import type { DockerSummary, UserRole } from '../types';
import { api } from '../services/api';

interface DockerContainersCardProps {
  docker: DockerSummary;
  userRole?: UserRole;
}

export const DockerContainersCard: React.FC<DockerContainersCardProps> = ({ docker, userRole = 'viewer' }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const canControl = userRole === 'admin' || userRole === 'operator';

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRestart = async (id: string, name: string) => {
    if (!canControl) return;
    setActionLoading(id);
    try {
      const res = await api.restartContainer(id);
      showNotification(res.message || `${name} yeniden başlatıldı`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'İşlem başarısız', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string, name: string) => {
    if (!canControl) return;
    setActionLoading(id);
    try {
      const res = await api.stopContainer(id);
      showNotification(res.message || `${name} durduruldu`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'İşlem başarısız', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (id: string, name: string) => {
    if (!canControl) return;
    setActionLoading(id);
    try {
      const res = await api.startContainer(id);
      showNotification(res.message || `${name} başlatıldı`, 'success');
    } catch (err: any) {
      showNotification(err.message || 'İşlem başarısız', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredContainers = useMemo(() => {
    if (!docker || !docker.containers) return [];
    return docker.containers.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.names.some((n) => n.toLowerCase().includes(q)) ||
        c.image.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'running') return c.state === 'running';
      if (statusFilter === 'stopped') return c.state !== 'running';
      return true;
    });
  }, [docker, search, statusFilter]);

  if (!docker.available) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Docker Konteynerleri
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Docker Soket Bağlantı Durumu</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-slate-950/60 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Docker Daemon Soketine Ulaşılamadı</p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {docker.error || 'Docker soketi (/var/run/docker.sock) tespit edilemedi.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-colors">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/20 text-blue-600 dark:text-blue-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Docker Konteynerleri
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                (Toplam {docker.containers_count})
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sunucuda Çalışan Aktif Konteynerlerin Durumu & Yönetimi
            </p>
          </div>
        </div>

        {/* State Badges Summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{docker.running_count} Çalışıyor</span>
          </div>
          {docker.stopped_count > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span>{docker.stopped_count} Durduruldu</span>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Konteyner veya imaj ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-0.5 text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tümü ({docker.containers_count})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'running'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Çalışanlar ({docker.running_count})
          </button>
          <button
            onClick={() => setStatusFilter('stopped')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'stopped'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Duranlar ({docker.stopped_count})
          </button>
        </div>
      </div>

      {/* Containers List / Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Konteyner Adı</th>
              <th className="py-2.5 px-3">İmaj</th>
              <th className="py-2.5 px-3">Durum</th>
              <th className="py-2.5 px-3 hidden md:table-cell">Port Yönlendirmeleri</th>
              {canControl && <th className="py-2.5 px-3 text-right">Yönetim</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredContainers.length > 0 ? (
              filteredContainers.map((c) => {
                const isRunning = c.state === 'running';
                const mainName = c.names[0] || c.id;
                const isLoading = actionLoading === c.id;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Name & ID */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isRunning ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs">{mainName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {c.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Image */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600 dark:text-cyan-300 truncate max-w-[200px]" title={c.image}>
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.image}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          isRunning
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {c.status || c.state}
                      </span>
                    </td>

                    {/* Ports */}
                    <td className="py-3 px-3 hidden md:table-cell">
                      {c.ports && c.ports.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {c.ports.slice(0, 3).map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-blue-500 dark:text-cyan-400" />
                              {p.public_port ? `${p.public_port}:` : ''}
                              {p.private_port}/{p.type}
                            </span>
                          ))}
                          {c.ports.length > 3 && (
                            <span className="text-[9px] text-slate-400 self-center">
                              +{c.ports.length - 3} daha
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    {canControl && (
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isRunning ? (
                            <>
                              <button
                                onClick={() => handleRestart(c.id, mainName)}
                                disabled={isLoading}
                                title="Yeniden Başlat (Restart)"
                                className="p-1.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:border-blue-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleStop(c.id, mainName)}
                                disabled={isLoading}
                                title="Durdur (Stop)"
                                className="p-1.5 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:border-red-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStart(c.id, mainName)}
                              disabled={isLoading}
                              title="Başlat (Start)"
                              className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:border-emerald-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={canControl ? 5 : 4} className="py-8 text-center text-slate-400">
                  {search ? 'Aramaya uygun konteyner bulunamadı.' : 'Kayıtlı konteyner bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
