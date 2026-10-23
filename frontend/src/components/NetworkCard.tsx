import React from 'react';
import { Network, ArrowDown, ArrowUp } from 'lucide-react';
import type { NetInterfaceInfo } from '../types';
import { formatBytes, formatSpeed } from '../utils/format';

interface NetworkCardProps {
  network: NetInterfaceInfo[];
}

export const NetworkCard: React.FC<NetworkCardProps> = ({ network }) => {
  // Aggregate total speeds
  const totalDownloadSpeed = network.reduce((acc, nic) => acc + nic.speed_recv_per_sec, 0);
  const totalUploadSpeed = network.reduce((acc, nic) => acc + nic.speed_sent_per_sec, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Ağ Trafiği (Network)
            </h2>
            <p className="text-xs text-slate-400">
              {network.length} Ağ Arayüzü Aktif
            </p>
          </div>
        </div>

        {/* Total Live Rates */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-[11px] font-mono">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300">{formatSpeed(totalDownloadSpeed)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-900/50 text-[11px] font-mono">
            <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300">{formatSpeed(totalUploadSpeed)}</span>
          </div>
        </div>
      </div>

      {/* Interface List */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {network && network.length > 0 ? (
          network.map((nic, idx) => (
            <div key={idx} className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/70 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  {nic.name}
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <ArrowDown className="w-3 h-3" />
                    {formatSpeed(nic.speed_recv_per_sec)}
                  </span>
                  <span className="text-cyan-400 flex items-center gap-0.5">
                    <ArrowUp className="w-3 h-3" />
                    {formatSpeed(nic.speed_sent_per_sec)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                <span>Gelen: {formatBytes(nic.bytes_recv)} ({nic.packets_recv.toLocaleString()} paket)</span>
                <span>Giden: {formatBytes(nic.bytes_sent)} ({nic.packets_sent.toLocaleString()} paket)</span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-500 text-center py-4">Ağ arayüzü bulunamadı</div>
        )}
      </div>
    </div>
  );
};
