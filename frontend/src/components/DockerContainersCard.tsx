import React, { useState, useMemo } from 'react';
import { Box, Play, Square, RotateCw, Search, AlertTriangle, Layers, ExternalLink, CheckCircle2 } from 'lucide-react';
import type { DockerSummary } from '../types';
import { api } from '../services/api';

interface DockerContainersCardProps {
  docker: DockerSummary;
}

export const DockerContainersCard: React.FC<DockerContainersCardProps> = ({ docker }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRestart = async (id: string, name: string) => {
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
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Docker Konteynerleri
            </h2>
            <p className="text-xs text-slate-400">Docker Soket Bağlantı Durumu</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-slate-300">
            <p className="font-medium text-amber-300">Docker Daemon Soketine Ulaşılamadı</p>
            <p className="text-slate-400 leading-relaxed">
              {docker.error || 'Docker soketi (/var/run/docker.sock) tespit edilemedi.'}
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              💡 <strong>Ubuntu Sunucu İpucu:</strong> <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">docker-compose.yml</code> dosyasında <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">/var/run/docker.sock:/var/run/docker.sock</code> volume bağlantısı tanımlıdır. Ubuntu sunucunuzda <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">docker compose up -d</code> çalıştırdığınızda aktif tüm konteynerler anlık burada listelenir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Docker Konteynerleri
              <span className="text-xs font-normal text-slate-400">
                (Toplam {docker.containers_count})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Sunucuda Çalışan Aktif Konteynerlerin Durumu & Yönetimi
            </p>
          </div>
        </div>

        {/* State Badges Summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{docker.running_count} Çalışıyor</span>
          </div>
          {docker.stopped_count > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
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
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Konteyner veya imaj ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex rounded-lg bg-slate-950/80 border border-slate-800 p-0.5 text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tümü ({docker.containers_count})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              statusFilter === 'running' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Çalışanlar ({docker.running_count})
          </button>
          <button
            onClick={() => setStatusFilter('stopped')}
            className={`flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              statusFilter === 'stopped' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'
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
            <tr className="border-b border-slate-800 text-slate-400 font-medium">
              <th className="py-2.5 px-3">Konteyner Adı</th>
              <th className="py-2.5 px-3">İmaj</th>
              <th className="py-2.5 px-3">Durum</th>
              <th className="py-2.5 px-3 hidden md:table-cell">Port Yönlendirmeleri</th>
              <th className="py-2.5 px-3 text-right">Yönetim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredContainers.length > 0 ? (
              filteredContainers.map((c) => {
                const isRunning = c.state === 'running';
                const mainName = c.names[0] || c.id;
                const isLoading = actionLoading === c.id;

                return (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Name & ID */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'
                          }`}
                        />
                        <div>
                          <div className="font-semibold text-slate-200 font-mono text-xs">{mainName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {c.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Image */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-300 truncate max-w-[180px]" title={c.image}>
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.image}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {c.status || c.state}
                      </span>
                    </td>

                    {/* Ports */}
                    <td className="py-3 px-3 hidden md:table-cell">
                      {c.ports && c.ports.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {c.ports.slice(0, 3).map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
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
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isRunning ? (
                          <>
                            <button
                              onClick={() => handleRestart(c.id, mainName)}
                              disabled={isLoading}
                              title="Yeniden Başlat (Restart)"
                              className="p-1.5 text-cyan-400 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleStop(c.id, mainName)}
                              disabled={isLoading}
                              title="Durdur (Stop)"
                              className="p-1.5 text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStart(c.id, mainName)}
                            disabled={isLoading}
                            title="Başlat (Start)"
                            className="p-1.5 text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
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
