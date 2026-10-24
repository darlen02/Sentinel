import React from 'react';
import { Network, ArrowDown, ArrowUp } from 'lucide-react';
import type { NetInterfaceInfo } from '../types';
import { formatBytes, formatSpeed } from '../utils/format';

interface NetworkCardProps {
  network: NetInterfaceInfo[];
}

export const NetworkCard: React.FC<NetworkCardProps> = ({ network }) => {
  const totalDownloadSpeed = network.reduce((acc, nic) => acc + nic.speed_recv_per_sec, 0);
  const totalUploadSpeed = network.reduce((acc, nic) => acc + nic.speed_sent_per_sec, 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col justify-between transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Network className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              Ağ Trafiği (Network)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              {network.length} Ağ Arayüzü Aktif İzleniyor
            </p>
          </div>
        </div>

        {/* Total Live Rates */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-[11px] font-mono">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{formatSpeed(totalDownloadSpeed)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] font-mono">
            <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span className="text-blue-700 dark:text-cyan-300 font-semibold">{formatSpeed(totalUploadSpeed)}</span>
          </div>
        </div>
      </div>

      {/* Interface List */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {network && network.length > 0 ? (
          network.map((nic, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/70 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  {nic.name}
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-semibold">
                    <ArrowDown className="w-3 h-3" />
                    {formatSpeed(nic.speed_recv_per_sec)}
                  </span>
                  <span className="text-blue-600 dark:text-cyan-400 flex items-center gap-0.5 font-semibold">
                    <ArrowUp className="w-3 h-3" />
                    {formatSpeed(nic.speed_sent_per_sec)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <span>Gelen: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(nic.bytes_recv)}</strong> ({nic.packets_recv.toLocaleString()} paket)</span>
                <span>Giden: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(nic.bytes_sent)}</strong> ({nic.packets_sent.toLocaleString()} paket)</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-400 text-center py-6">Ağ arayüzü bulunamadı</div>
        )}
      </div>
    </div>
  );
};
