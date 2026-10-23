import React from 'react';
import { HardDrive, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { DiskPartition, DiskIOInfo } from '../types';
import { formatBytes, formatSpeed, getStatusColor } from '../utils/format';

interface DiskCardProps {
  disks: DiskPartition[];
  diskIO: DiskIOInfo;
}

export const DiskCard: React.FC<DiskCardProps> = ({ disks, diskIO }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Depolama & Diskler
            </h2>
            <p className="text-xs text-slate-400">
              {disks.length} Bağlı Bölüm Tespit Edildi
            </p>
          </div>
        </div>

        {/* Live Disk I/O Speeds */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono">
            <ArrowDownToLine className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">R:</span>
            <span className="text-slate-200">{formatSpeed(diskIO.read_bytes_per_sec)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono">
            <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">W:</span>
            <span className="text-slate-200">{formatSpeed(diskIO.write_bytes_per_sec)}</span>
          </div>
        </div>
      </div>

      {/* Partitions List */}
      <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
        {disks && disks.length > 0 ? (
          disks.map((d, idx) => {
            const status = getStatusColor(d.used_percent);
            return (
              <div key={idx} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/70">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-slate-200 font-mono">{d.mountpoint}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                      {d.fstype || 'ext4'}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[120px] hidden sm:inline" title={d.device}>
                      {d.device}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold ${status.text}`}>{d.used_percent.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mb-1.5 border border-slate-800/80">
                  <div
                    className={`h-full ${status.bar} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(1, d.used_percent))}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Kullanılan: {formatBytes(d.used)}</span>
                  <span>Boş: <strong className="text-slate-300">{formatBytes(d.free)}</strong> / Toplam: {formatBytes(d.total)}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-slate-500 text-center py-4">Bölüm bilgisi bulunamadı</div>
        )}
      </div>
    </div>
  );
};
