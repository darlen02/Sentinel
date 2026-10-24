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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col justify-between transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              Depolama & Diskler
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              {disks.length} Bağlı Bölüm Tespit Edildi
            </p>
          </div>
        </div>

        {/* Live Disk I/O Speeds */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
            <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span className="text-slate-500">R:</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatSpeed(diskIO.read_bytes_per_sec)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
            <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-slate-500">W:</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{formatSpeed(diskIO.write_bytes_per_sec)}</span>
          </div>
        </div>
      </div>

      {/* Partitions List */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {disks && disks.length > 0 ? (
          disks.map((d, idx) => {
            const status = getStatusColor(d.used_percent);
            return (
              <div key={idx} className="bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/70">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-900 dark:text-slate-200 font-mono">{d.mountpoint}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono font-medium">
                      {d.fstype || 'ext4'}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[150px] hidden sm:inline" title={d.device}>
                      {d.device}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold ${status.text}`}>{d.used_percent.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-900 h-2 rounded-full overflow-hidden mb-1.5 border border-slate-200/80 dark:border-slate-800/80">
                  <div
                    className={`h-full ${status.bar} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(1, d.used_percent))}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Kullanılan: {formatBytes(d.used)}</span>
                  <span>Boş: <strong className="text-slate-700 dark:text-slate-300">{formatBytes(d.free)}</strong> / Toplam: {formatBytes(d.total)}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-slate-400 text-center py-6">Bölüm bilgisi bulunamadı</div>
        )}
      </div>
    </div>
  );
};
