import React from 'react';
import { getStatusHex, getStatusLabel } from '../utils/format';

interface RingGaugeProps {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Primary accent color used when load is normal (<65%), e.g. #06b6d4 for CPU, #8b5cf6 for RAM */
  themeColor?: string;
  caption?: string;
}

/**
 * Modern 260° circular telemetry gauge.
 * Features:
 * - Symmetrically centered 100° bottom gap (arc sweeps 260° from 140° to 40°).
 * - Pixel-perfect vertical optical centering for percentage and status badge.
 * - Respects the card's theme color, automatically alerting with warning/critical colors when load spikes.
 * - Clean layout: percentage + badge inside the ring, caption neatly placed below.
 */
export const RingGauge: React.FC<RingGaugeProps> = ({
  value,
  size = 92,
  strokeWidth = 7.5,
  themeColor,
  caption,
}) => {
  const v = Math.min(100, Math.max(0, value));

  // Determine dynamic status color
  let color = themeColor || getStatusHex(v);
  if (v >= 85) {
    color = '#f43f5e'; // Critical (Rose/Red)
  } else if (v >= 65) {
    color = '#f59e0b'; // Warning (Amber)
  }

  const statusLabel = getStatusLabel(v);

  // Geometry: 260° arc with a 100° gap at the bottom
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const arcTotal = c * (260 / 360);
  const activeLength = (arcTotal * v) / 100;

  return (
    <div className="flex flex-col items-center justify-center shrink-0 select-none">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${caption ?? 'Kullanım'}: yüzde ${v.toFixed(1)}, durum ${statusLabel}`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Rotate 140deg so the 260deg arc sweeps clockwise starting at bottom-left (140°) to bottom-right (40°) */}
          <g transform={`rotate(140 ${center} ${center})`}>
            {/* Background track */}
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${arcTotal} ${c}`}
              className="stroke-slate-200/90 dark:stroke-slate-800"
            />

            {/* Active progress arc */}
            {v > 0 && (
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                stroke={color}
                strokeDasharray={`${Math.max(activeLength, 0.5)} ${c}`}
                style={{
                  transition: 'stroke-dasharray 450ms cubic-bezier(0.4, 0, 0.2, 1), stroke 350ms ease',
                }}
              />
            )}
          </g>
        </svg>

        {/* Center content: percentage and status badge optically aligned with the 260° arc */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          style={{ transform: 'translateY(-3px)' }}
        >
          <div className="flex items-baseline justify-center font-mono font-extrabold text-slate-900 dark:text-white leading-none">
            <span
              className="tracking-tight"
              style={{ fontSize: Math.round(size * 0.24) }}
            >
              {v.toFixed(v >= 100 ? 0 : 1)}
            </span>
            <span
              className="font-bold text-slate-400 dark:text-slate-500 ml-0.5"
              style={{ fontSize: Math.round(size * 0.12) }}
            >
              %
            </span>
          </div>

          <span
            className="mt-1 px-2 py-0.5 font-bold rounded-full uppercase tracking-wider border leading-none"
            style={{
              fontSize: Math.max(9, Math.round(size * 0.1)),
              color,
              backgroundColor: `${color}18`,
              borderColor: `${color}35`,
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Caption beneath the gauge in the natural bottom opening */}
      {caption && (
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 -mt-1.5 tracking-wide">
          {caption}
        </span>
      )}
    </div>
  );
};
