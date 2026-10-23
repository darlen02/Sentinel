import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import type { CpuInfo } from '../types';
import { Sparkline } from './Sparkline';
import { getStatusColor } from '../utils/format';

interface CpuCardProps {
  cpu: CpuInfo;
  history: number[];
}

export const CpuCard: React.FC<CpuCardProps> = ({ cpu, history }) => {
  const status = getStatusColor(cpu.overall_percent);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              İşlemci (CPU)
              <span className="text-xs font-normal text-slate-400">
                {cpu.logical_cores} Çekirdek ({cpu.physical_cores || cpu.logical_cores} Fiziksel)
              </span>
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-[360px]" title={cpu.model_name}>
              {cpu.model_name || 'İşlemci Bilgisi'} {cpu.mhz > 0 ? `@ ${(cpu.mhz / 1000).toFixed(2)} GHz` : ''}
            </p>
          </div>
        </div>

        {/* Current Big Metric */}
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${status.text} flex items-center justify-end gap-1`}>
            {cpu.overall_percent.toFixed(1)}%
          </div>
          <span className="text-[11px] text-slate-400">Toplam Yük</span>
        </div>
      </div>

      {/* Main Sparkline Graph */}
      <div className="my-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-2">
          <span>Kullanım Geçmişi (Canlı)</span>
          <span className="font-mono text-cyan-400">30 Örnek</span>
        </div>
        <div className="h-16 w-full">
          <Sparkline data={history} max={100} min={0} color="#06b6d4" />
        </div>
      </div>

      {/* Per-Core Distribution Grid */}
      {cpu.cores_percent && cpu.cores_percent.length > 0 && (
        <div className="mt-3">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
            <span>Çekirdek Dağılımı</span>
            <span className="text-[11px] text-slate-400">
              Maks: {Math.max(...cpu.cores_percent).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 max-h-24 overflow-y-auto pr-1">
            {cpu.cores_percent.map((coreVal, idx) => {
              const coreStatus = getStatusColor(coreVal);
              return (
                <div
                  key={idx}
                  className="bg-slate-950/50 border border-slate-800/60 rounded-md p-1.5 flex flex-col items-center justify-center text-center"
                  title={`Çekirdek #${idx}: ${coreVal}%`}
                >
                  <span className="text-[9px] text-slate-400">C{idx}</span>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
                    <div
                      className={`h-full ${coreStatus.bar} transition-all duration-300`}
                      style={{ width: `${Math.min(100, Math.max(2, coreVal))}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-mono ${coreStatus.text}`}>{coreVal.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Load Averages Footer */}
      {(cpu.load_1 > 0 || cpu.load_5 > 0 || cpu.load_15 > 0) && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Average:</span>
          </span>
          <div className="flex gap-2 font-mono text-slate-300">
            <span title="1 dk">{cpu.load_1.toFixed(2)}</span>
            <span className="text-slate-600">/</span>
            <span title="5 dk">{cpu.load_5.toFixed(2)}</span>
            <span className="text-slate-600">/</span>
            <span title="15 dk">{cpu.load_15.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
