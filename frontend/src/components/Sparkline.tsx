import React, { useState } from 'react';

interface SparklineProps {
  data: number[];
  max?: number;
  min?: number;
  color?: string;
  height?: number;
  unit?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  max = 100,
  min = 0,
  color = '#3b82f6',
  height = 65,
  unit = '%',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        style={{ height }}
        className="w-full bg-slate-100 dark:bg-slate-950/60 rounded-xl flex items-center justify-center text-xs text-slate-400"
      >
        Telemetri verisi toplanıyor...
      </div>
    );
  }

  const width = 350;
  const paddingY = 6;
  const usableHeight = height - paddingY * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((val, idx) => {
    const clamped = Math.max(min, Math.min(max, val));
    const normalized = (clamped - min) / (max - min || 1);
    const x = idx * stepX;
    const y = height - paddingY - normalized * usableHeight;
    return { x, y, val };
  });

  // Calculate smooth Bezier curve
  const pathD = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[idx - 1];
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  const peakVal = Math.max(...data);
  const avgVal = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);

  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="relative w-full">
      {/* Top Value Badges */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1 px-1">
        <div className="flex items-center gap-2">
          <span>Ort: <strong className="text-slate-700 dark:text-slate-200">{avgVal}{unit}</strong></span>
          <span>•</span>
          <span>Maks: <strong className="text-slate-700 dark:text-slate-200">{peakVal.toFixed(1)}{unit}</strong></span>
        </div>
        <div className="flex items-center gap-1 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
          <span style={{ color }}>{activePoint.val.toFixed(1)}{unit}</span>
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden"
        style={{ height }}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xPos = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, xPos / rect.width));
          const idx = Math.round(ratio * (points.length - 1));
          setHoverIdx(idx);
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="90%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradId})`} />

          {/* Smooth Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Hover / Current Dot */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={height}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4"
                fill={color}
                stroke="#ffffff"
                strokeWidth="1.5"
                className="drop-shadow-md"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
