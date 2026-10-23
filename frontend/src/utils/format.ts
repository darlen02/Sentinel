export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return '0 B';
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'B'}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function getStatusColor(percent: number): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  glow: string;
} {
  if (percent >= 85) {
    return {
      text: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      border: 'border-rose-200 dark:border-rose-500/30',
      bar: 'bg-rose-500',
      glow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)]',
    };
  }
  if (percent >= 65) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      bar: 'bg-amber-500',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
    };
  }
  return {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
  };
}
