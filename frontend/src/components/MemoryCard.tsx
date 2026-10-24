import React, { useMemo } from 'react';
import { Layers, Activity } from 'lucide-react';
import type { MemoryInfo, LiveSample } from '../types';
import { TimeSeriesChart, PERCENT_BANDS, PERCENT_TICKS } from './TimeSeriesChart';
import { RingGauge } from './RingGauge';
import { StatChip } from './StatChip';
import { formatBytes, getStatusColor } from '../utils/format';

interface MemoryCardProps {
  memory: MemoryInfo;
  samples: LiveSample[];
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ memory, samples }) => {
  const ramStatus = getStatusColor(memory.used_percent);
  const swapStatus = getStatusColor(memory.swap_used_percent);

  const times = useMemo(() => samples.map((s) => s.t), [samples]);
  const memValues = useMemo(() => samples.map((s) => s.mem), [samples]);

  const { avgMem, peakMem } = useMemo(() => {
    if (!samples.length) return { avgMem: memory.used_percent, peakMem: memory.used_percent };
    let sum = 0;
    let max = 0;
    for (const s of samples) {
      sum += s.mem;
      if (s.mem > max) max = s.mem;
    }
    return {
      avgMem: Math.round((sum / samples.length) * 10) / 10,
      peakMem: Math.round(max * 10) / 10,
    };
  }, [samples, memory.used_percent]);

  const series = useMemo(
    () => [
      {
        key: 'mem',
        label: 'RAM Kullanımı (%)',
        color: '#8b5cf6', // Violet
        values: memValues,
        area: true,
        width: 2.5,
        format: (v: number) => `%${v.toFixed(1)}`,
      },
    ],
    [memValues]
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-colors">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/80 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bellek (RAM & Swap)
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-900/60">
                {formatBytes(memory.total)} Toplam
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-[420px] mt-0.5">
              Kullanılan: {formatBytes(memory.used)} · Boş: {formatBytes(memory.available)}
            </p>
          </div>
        </div>

        {/* Current Circular Gauge in a subtle card container */}
        <div className="flex items-center self-center sm:self-auto bg-slate-50/80 dark:bg-slate-950/50 p-2 px-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
          <RingGauge value={memory.used_percent} size={86} themeColor="#8b5cf6" caption="Anlık RAM" />
        </div>
      </div>

      {/* Main TimeSeries Graph with Axis, Legend, and Danger Zones */}
      <div className="my-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Canlı RAM Tüketim Akışı (Zaman Ekseni)
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Ölçek: 0 - %100
          </span>
        </div>

        <TimeSeriesChart
          times={times}
          series={series}
          height={160}
          yMax={100}
          yTicks={PERCENT_TICKS}
          yFormat={(v) => `%${v}`}
          bands={PERCENT_BANDS}
          xMode="relative"
          showLastDot
          emptyText="Canlı bellek telemetrisi bekleniyor..."
        />
      </div>

      {/* Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        <StatChip label="Kullanılan RAM" value={formatBytes(memory.used)} tone="text-purple-600 dark:text-purple-400" hint="Aktif çalışan süreçlerin kullandığı bellek" />
        <StatChip label="Kullanılabilir RAM" value={formatBytes(memory.available)} tone="text-emerald-600 dark:text-emerald-400" hint="Yeni uygulamalar için ayrılabilen bellek" />
        <StatChip label="Ortalama (Son 2dk)" value={`%${avgMem.toFixed(1)}`} hint="Görüntülenen penceredeki ortalama" />
        <StatChip label="Zirve (Tepe)" value={`%${peakMem.toFixed(1)}`} tone="text-amber-600 dark:text-amber-400" hint="Görüntülenen penceredeki maksimum" />
      </div>

      {/* Progress Bars: RAM & Swap */}
      <div className="space-y-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {/* Physical RAM Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Fiziksel RAM</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              Kullanılan: <strong className="text-slate-800 dark:text-slate-200">{formatBytes(memory.used)}</strong> / Toplam: {formatBytes(memory.total)}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
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
              <span className="text-slate-700 dark:text-slate-300 font-medium">Swap (Takas Alanı)</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                {formatBytes(memory.swap_used)} / {formatBytes(memory.swap_total)} ({memory.swap_used_percent.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
              <div
                className={`h-full ${swapStatus.bar} transition-all duration-300`}
                style={{ width: `${Math.min(100, memory.swap_used_percent)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            Swap alanı yapılandırılmamış veya devre dışı.
          </div>
        )}
      </div>
    </div>
  );
};
