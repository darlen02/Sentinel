import React, { useMemo } from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';
import type { CpuInfo, LiveSample } from '../types';
import { TimeSeriesChart, PERCENT_BANDS, PERCENT_TICKS } from './TimeSeriesChart';
import { RingGauge } from './RingGauge';
import { StatChip } from './StatChip';
import { getStatusColor } from '../utils/format';

interface CpuCardProps {
  cpu: CpuInfo;
  samples: LiveSample[];
}

export const CpuCard: React.FC<CpuCardProps> = ({ cpu, samples }) => {
  const times = useMemo(() => samples.map((s) => s.t), [samples]);
  const cpuValues = useMemo(() => samples.map((s) => s.cpu), [samples]);

  const { avgCpu, peakCpu } = useMemo(() => {
    if (!samples.length) return { avgCpu: cpu.overall_percent, peakCpu: cpu.overall_percent };
    let sum = 0;
    let max = 0;
    for (const s of samples) {
      sum += s.cpu;
      if (s.cpu > max) max = s.cpu;
    }
    return {
      avgCpu: Math.round((sum / samples.length) * 10) / 10,
      peakCpu: Math.round(max * 10) / 10,
    };
  }, [samples, cpu.overall_percent]);

  const series = useMemo(
    () => [
      {
        key: 'cpu',
        label: 'İşlemci Yükü (%)',
        color: '#06b6d4', // Cyan
        values: cpuValues,
        area: true,
        width: 2.5,
        format: (v: number) => `%${v.toFixed(1)}`,
      },
    ],
    [cpuValues]
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-colors">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200/80 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                İşlemci (CPU)
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-cyan-50/70 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-900/60">
                {cpu.logical_cores} Çekirdek ({cpu.physical_cores || cpu.logical_cores} Fiziksel)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-[420px] mt-0.5" title={cpu.model_name}>
              {cpu.model_name || 'İşlemci'} {cpu.mhz > 0 ? `@ ${(cpu.mhz / 1000).toFixed(2)} GHz` : ''}
            </p>
          </div>
        </div>

        {/* Current Circular Gauge in a subtle card container */}
        <div className="flex items-center self-center sm:self-auto bg-slate-50/80 dark:bg-slate-950/50 p-2 px-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
          <RingGauge value={cpu.overall_percent} size={86} themeColor="#06b6d4" caption="Anlık CPU" />
        </div>
      </div>

      {/* Main TimeSeries Graph with Axis, Legend, and Danger Zones */}
      <div className="my-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Canlı Yük Akışı (Zaman Ekseni)
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
          emptyText="Canlı CPU telemetrisi bekleniyor..."
        />
      </div>

      {/* Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        <StatChip label="Anlık Yük" value={`%${cpu.overall_percent.toFixed(1)}`} hint="Son telemetri okuması" />
        <StatChip label="Ortalama (Son 2dk)" value={`%${avgCpu.toFixed(1)}`} hint="Görüntülenen penceredeki ortalama" />
        <StatChip label="Zirve (Tepe)" value={`%${peakCpu.toFixed(1)}`} tone="text-amber-600 dark:text-amber-400" hint="Görüntülenen penceredeki maksimum" />
        <StatChip label="Load (1 dk)" value={cpu.load_1.toFixed(2)} hint="1 dakikalık sistem yük ortalaması" />
      </div>

      {/* Per-Core Distribution Grid */}
      {cpu.cores_percent && cpu.cores_percent.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">Çekirdek Başına Dağılım</span>
            <span className="text-[11px] font-mono">
              En Yüksek: <strong className="text-slate-800 dark:text-slate-200">{Math.max(...cpu.cores_percent).toFixed(1)}%</strong>
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5 max-h-24 overflow-y-auto pr-1">
            {cpu.cores_percent.map((coreVal, idx) => {
              const coreStatus = getStatusColor(coreVal);
              return (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-lg p-1.5 flex flex-col items-center justify-center text-center"
                  title={`Çekirdek #${idx}: ${coreVal}%`}
                >
                  <span className="text-[9px] text-slate-500 font-mono">C{idx}</span>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
                    <div
                      className={`h-full ${coreStatus.bar} transition-all duration-300`}
                      style={{ width: `${Math.min(100, Math.max(2, coreVal))}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono font-semibold ${coreStatus.text}`}>{coreVal.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Load Averages Footer */}
      {(cpu.load_1 > 0 || cpu.load_5 > 0 || cpu.load_15 > 0) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">Sistem Yük Ortalaması (Load Avg):</span>
          </span>
          <div className="flex gap-2 font-mono font-medium text-slate-700 dark:text-slate-300">
            <span title="1 dakika">{cpu.load_1.toFixed(2)}</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span title="5 dakika">{cpu.load_5.toFixed(2)}</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span title="15 dakika">{cpu.load_15.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
