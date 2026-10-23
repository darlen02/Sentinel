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
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      bar: 'bg-red-500',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]',
    };
  }
  if (percent >= 65) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      bar: 'bg-amber-500',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    };
  }
  return {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
  };
}
