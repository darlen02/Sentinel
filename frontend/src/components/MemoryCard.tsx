import React from 'react';
import { Layers } from 'lucide-react';
import type { MemoryInfo } from '../types';
import { Sparkline } from './Sparkline';
import { formatBytes, getStatusColor } from '../utils/format';

interface MemoryCardProps {
  memory: MemoryInfo;
  history: number[];
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ memory, history }) => {
  const ramStatus = getStatusColor(memory.used_percent);
  const swapStatus = getStatusColor(memory.swap_used_percent);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Bellek (RAM & Swap)
            </h2>
            <p className="text-xs text-slate-400">
              Toplam {formatBytes(memory.total)} Fiziksel Bellek
            </p>
          </div>
        </div>

        {/* Current Big Metric */}
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${ramStatus.text} flex items-center justify-end gap-1`}>
            {memory.used_percent.toFixed(1)}%
          </div>
          <span className="text-[11px] text-slate-400">Kullanılan RAM</span>
        </div>
      </div>

      {/* Main Sparkline Graph */}
      <div className="my-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-2">
          <span>RAM Tüketim Geçmişi</span>
          <span className="font-mono text-violet-400">
            {formatBytes(memory.used)} / {formatBytes(memory.total)}
          </span>
        </div>
        <div className="h-16 w-full">
          <Sparkline data={history} max={100} min={0} color="#a855f7" />
        </div>
      </div>

      {/* Progress Bars: RAM & Swap */}
      <div className="space-y-3 mt-3">
        {/* Physical RAM Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300 font-medium">Fiziksel RAM</span>
            <span className="text-slate-400 font-mono text-[11px]">
              Kullanılan: <strong className="text-slate-200">{formatBytes(memory.used)}</strong> / Boş: {formatBytes(memory.available)}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full ${ramStatus.bar} transition-all duration-300`}
              style={{ width: `${Math.min(100, Math.max(1, memory.used_percent))}%` }}
            />
          </div>
        </div>

        {/* Swap Bar */}
        {memory.swap_total > 0 ? (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Swap (Takas Alanı)</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {formatBytes(memory.swap_used)} / {formatBytes(memory.swap_total)} ({memory.swap_used_percent.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full ${swapStatus.bar} transition-all duration-300`}
                style={{ width: `${Math.min(100, memory.swap_used_percent)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic">
            Swap alanı yapılandırılmamış veya devre dışı.
          </div>
        )}
      </div>

      {/* Summary Stats Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
          <span className="text-slate-400 text-[10px] block">Kullanılabilir RAM</span>
          <span className="text-emerald-400 font-mono font-semibold">{formatBytes(memory.available)}</span>
        </div>
        <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
          <span className="text-slate-400 text-[10px] block">Tam Boş RAM</span>
          <span className="text-slate-300 font-mono font-semibold">{formatBytes(memory.free)}</span>
        </div>
      </div>
    </div>
  );
};
