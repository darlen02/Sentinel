import React from 'react';

interface SparklineProps {
  data: number[];
  max?: number;
  min?: number;
  color?: string;
  fillColor?: string;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  max = 100,
  min = 0,
  color = '#38bdf8',
  height = 50,
}) => {
  if (data.length < 2) {
    return <div style={{ height }} className="w-full bg-slate-900/40 rounded flex items-center justify-center text-xs text-slate-500">Veri toplanıyor...</div>;
  }

  const width = 300;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((val, idx) => {
    const clamped = Math.max(min, Math.min(max, val));
    const normalized = (clamped - min) / (max - min || 1);
    const x = idx * stepX;
    const y = height - paddingY - normalized * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkline-grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sparkline-grad-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current point dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
};
