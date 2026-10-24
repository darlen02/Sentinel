import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { formatDuration } from '../utils/format';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** One value per entry in `times`; null breaks the line. */
  values: (number | null)[];
  area?: boolean;
  dashed?: boolean;
  step?: boolean;
  width?: number;
  /** Overrides the chart-level value formatter (axis uses the chart formatter). */
  format?: (v: number) => string;
}

export interface ChartBand {
  from: number;
  to: number;
  color: string;
  label?: string;
  labelColor?: string;
}

export interface ChartRefLine {
  value: number;
  label: string;
  color: string;
}

export const PERCENT_TICKS = [0, 25, 50, 75, 100];

/** Shaded "danger zones" that match the status colors used across the dashboard. */
export const PERCENT_BANDS: ChartBand[] = [
  { from: 65, to: 85, color: 'rgba(245,158,11,0.09)', label: 'Yüksek', labelColor: '#d97706' },
  { from: 85, to: 100, color: 'rgba(244,63,94,0.11)', label: 'Kritik', labelColor: '#e11d48' },
];

interface TimeSeriesChartProps {
  /** Sample timestamps in ms, ascending. */
  times: number[];
  series: ChartSeries[];
  height?: number;
  /** Fixed Y axis maximum (the axis always starts at 0). Omit for automatic scaling. */
  yMax?: number;
  /** Explicit tick values; only used together with `yMax`. */
  yTicks?: number[];
  /** Automatic scaling never goes below this maximum. */
  yAutoFloor?: number;
  /** 1024 for byte based values so ticks land on KB/MB/GB boundaries. */
  yBase?: 1000 | 1024;
  yInteger?: boolean;
  yFormat: (v: number) => string;
  bands?: ChartBand[];
  refLines?: ChartRefLine[];
  /** Visible time window. Defaults to the first/last sample. */
  xDomain?: [number, number];
  /** relative: "-2 dk … şimdi" (live data). clock: real clock times (history). */
  xMode?: 'relative' | 'clock';
  /** Samples further apart than this are not connected. Detected automatically when omitted. */
  gapMs?: number;
  /** Controlled hover index so several charts can be inspected together. */
  activeIndex?: number | null;
  onActiveIndexChange?: (index: number | null) => void;
  tooltipFooter?: (index: number) => ReactNode;
  showLastDot?: boolean;
  emptyText?: string;
  ariaLabel?: string;
}

interface XTick {
  t: number;
  label: string;
}

const REL_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((s) => s * 1000);
const CLOCK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map(
  (m) => m * 60000
);

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / Math.max(targetTicks, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

function autoScale(dataMax: number, floor: number, base: 1000 | 1024, integer: boolean) {
  const top = Math.max(dataMax, floor, 1e-9);
  let unit = 1;
  if (base === 1024) {
    const exp = Math.max(0, Math.floor(Math.log(top) / Math.log(1024)));
    unit = Math.pow(1024, exp);
  }
  const scaledTop = top / unit;
  let step = niceStep(scaledTop, 4);
  if (integer) step = Math.max(1, Math.ceil(step));
  const niceMax = Math.ceil(scaledTop / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step * 1e-6; v += step) {
    ticks.push(v * unit);
  }
  return { max: niceMax * unit, ticks };
}

function formatShort(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}sn`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min < 60) return rest ? `${min}dk ${rest}sn` : `${min}dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}sa ${m}dk` : `${h}sa`;
}

function pickStep(steps: number[], span: number, maxTicks: number): number {
  for (const s of steps) {
    if (span / s <= maxTicks) return s;
  }
  return steps[steps.length - 1];
}

function buildXTicks(d0: number, d1: number, mode: 'relative' | 'clock', plotW: number): XTick[] {
  const maxTicks = Math.max(2, Math.floor(plotW / 84));
  const span = d1 - d0;
  const ticks: XTick[] = [];

  if (mode === 'relative') {
    const step = pickStep(REL_STEPS, span, maxTicks);
    for (let k = 0; d1 - k * step >= d0; k++) {
      ticks.push({ t: d1 - k * step, label: k === 0 ? 'şimdi' : `-${formatShort(k * step)}` });
    }
    return ticks;
  }

  const step = pickStep(CLOCK_STEPS, span, maxTicks);
  const offset = -new Date(d1).getTimezoneOffset() * 60000;
  const multiDay = span > 24 * 3600 * 1000 * 1.05;
  for (let t = Math.ceil((d0 + offset) / step) * step - offset; t <= d1; t += step) {
    const date = new Date(t);
    const hhmm = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const day = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    let label = hhmm;
    if (step >= 86400000) label = day;
    else if (multiDay) label = `${day} ${hhmm}`;
    ticks.push({ t, label });
  }
  return ticks;
}

function autoGap(times: number[]): number {
  if (times.length < 4) return Infinity;
  const deltas: number[] = [];
  for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
  deltas.sort((a, b) => a - b);
  return Math.max(deltas[Math.floor(deltas.length / 2)], 1) * 3.5;
}

function nearestIndex(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[lo] - t) <= Math.abs(times[hi] - t) ? lo : hi;
}

/** Splits a series into runs of consecutive samples, breaking on missing values and time gaps. */
function buildSegments(times: number[], values: (number | null)[], gap: number): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    if (current.length && times[i] - times[current[current.length - 1]] > gap) {
      segments.push(current);
      current = [];
    }
    current.push(i);
  }
  if (current.length) segments.push(current);
  return segments;
}

export function TimeSeriesChart({
  times,
  series,
  height = 200,
  yMax,
  yTicks,
  yAutoFloor,
  yBase = 1000,
  yInteger = false,
  yFormat,
  bands,
  refLines,
  xDomain,
  xMode = 'relative',
  gapMs,
  activeIndex,
  onActiveIndexChange,
  tooltipFooter,
  showLastDot = false,
  emptyText = 'Veri toplanıyor...',
  ariaLabel,
}: TimeSeriesChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [containerRef, width] = useContainerWidth<HTMLDivElement>();
  const [internalActive, setInternalActive] = useState<number | null>(null);

  const controlled = onActiveIndexChange !== undefined;
  const rawActive = controlled ? activeIndex ?? null : internalActive;
  const active = rawActive !== null && rawActive < times.length ? rawActive : null;
  const setActive = (i: number | null) => {
    if (controlled) onActiveIndexChange?.(i);
    else setInternalActive(i);
  };

  const hasData = times.length > 0;

  // ---- Y scale ----
  let yScale: { max: number; ticks: number[] };
  if (yMax !== undefined) {
    yScale = { max: yMax, ticks: yTicks ?? [0, yMax / 2, yMax] };
  } else {
    let dataMax = 0;
    for (const s of series) {
      for (const v of s.values) {
        if (v !== null && v !== undefined && Number.isFinite(v) && v > dataMax) dataMax = v;
      }
    }
    yScale = autoScale(dataMax, yAutoFloor ?? 0, yBase, yInteger);
  }
  const yTop = yScale.max > 0 ? yScale.max : 1;

  // ---- layout ----
  const labelChars = Math.max(...yScale.ticks.map((t) => yFormat(t).length), 2);
  const m = { top: 12, right: 16, bottom: 28, left: Math.ceil(labelChars * 6.2) + 14 };
  const plotW = Math.max(width - m.left - m.right, 10);
  const plotH = Math.max(height - m.top - m.bottom, 10);

  // ---- X scale ----
  let d0 = xDomain ? xDomain[0] : hasData ? times[0] : 0;
  let d1 = xDomain ? xDomain[1] : hasData ? times[times.length - 1] : 1;
  if (d1 - d0 < 1000) {
    // A single sample: show a 30s window ending at it.
    d0 -= 30000;
  }
  const xOf = (t: number) => m.left + ((t - d0) / (d1 - d0)) * plotW;
  const yOf = (v: number) => m.top + (1 - Math.min(Math.max(v, 0), yTop) / yTop) * plotH;
  const baseY = m.top + plotH;

  const gap = gapMs ?? autoGap(times);
  const xTicks = width > 0 ? buildXTicks(d0, d1, xMode, plotW) : [];

  const handleMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!hasData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = d0 + (px / plotW) * (d1 - d0);
    const i = nearestIndex(times, t);
    const tol = Math.max(gap / 2, ((d1 - d0) / plotW) * 24);
    setActive(Math.abs(times[i] - t) <= tol ? i : null);
  };

  const showLegend = series.length > 1;

  return (
    <div className="w-full">
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 font-medium">
              <span
                className="inline-block w-3.5 rounded-sm"
                style={
                  s.dashed
                    ? { borderTop: `2px dashed ${s.color}`, height: 0 }
                    : { backgroundColor: s.color, height: s.area ? 8 : 3, opacity: s.area ? 0.85 : 1 }
                }
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative w-full" style={{ height }}>
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            {emptyText}
          </div>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={height}
                className="block overflow-visible select-none"
                role="img"
                aria-label={ariaLabel}
              >
                <defs>
                  {series.map(
                    (s, idx) =>
                      s.area && (
                        <linearGradient
                          key={s.key}
                          id={`${uid}g${idx}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                        </linearGradient>
                      )
                  )}
                  <clipPath id={`${uid}clip`}>
                    <rect x={m.left} y={m.top - 3} width={plotW} height={plotH + 6} />
                  </clipPath>
                </defs>

                {/* Status zones */}
                {bands?.map((b, i) => (
                  <g key={i}>
                    <rect
                      x={m.left}
                      y={yOf(b.to)}
                      width={plotW}
                      height={Math.max(yOf(b.from) - yOf(b.to), 0)}
                      fill={b.color}
                    />
                    {b.label && (
                      <text
                        x={m.left + 6}
                        y={yOf(b.to) + 11}
                        fontSize={10}
                        fontWeight={600}
                        fill={b.labelColor ?? '#64748b'}
                        opacity={0.9}
                      >
                        {b.label}
                      </text>
                    )}
                  </g>
                ))}

                {/* Horizontal grid + Y labels */}
                {yScale.ticks.map((v) => {
                  const y = yOf(v);
                  const isBase = v === 0;
                  return (
                    <g key={v}>
                      <line
                        x1={m.left}
                        x2={m.left + plotW}
                        y1={y}
                        y2={y}
                        className={
                          isBase
                            ? 'stroke-slate-300 dark:stroke-slate-700'
                            : 'stroke-slate-200 dark:stroke-slate-800'
                        }
                        strokeDasharray={isBase ? undefined : '3 4'}
                      />
                      <text
                        x={m.left - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        className="fill-slate-500 dark:fill-slate-400 font-mono"
                        fontSize={10}
                      >
                        {yFormat(v)}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical grid + time labels */}
                {xTicks.map((tk, i) => {
                  const x = xOf(tk.t);
                  const anchor =
                    x < m.left + 18 ? 'start' : x > m.left + plotW - 18 ? 'end' : 'middle';
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        x2={x}
                        y1={m.top}
                        y2={baseY + 4}
                        className="stroke-slate-100 dark:stroke-slate-800/60"
                      />
                      <text
                        x={x}
                        y={baseY + 18}
                        textAnchor={anchor}
                        className="fill-slate-500 dark:fill-slate-400 font-mono"
                        fontSize={10}
                      >
                        {tk.label}
                      </text>
                    </g>
                  );
                })}

                {/* Reference lines */}
                {refLines?.map((r, i) => {
                  if (r.value > yTop) return null;
                  const y = yOf(r.value);
                  return (
                    <g key={i}>
                      <line
                        x1={m.left}
                        x2={m.left + plotW}
                        y1={y}
                        y2={y}
                        stroke={r.color}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                      />
                      <text
                        x={m.left + plotW - 4}
                        y={y - 5}
                        textAnchor="end"
                        fontSize={10}
                        fontWeight={600}
                        fill={r.color}
                      >
                        {r.label}
                      </text>
                    </g>
                  );
                })}

                {/* Data */}
                <g clipPath={`url(#${uid}clip)`}>
                  {series.map((s, idx) => {
                    const segments = buildSegments(times, s.values, gap);
                    return (
                      <g key={s.key}>
                        {segments.map((seg, k) => {
                          if (seg.length === 1) {
                            const i = seg[0];
                            return (
                              <circle
                                key={k}
                                cx={xOf(times[i])}
                                cy={yOf(s.values[i] as number)}
                                r={2.5}
                                fill={s.color}
                              />
                            );
                          }
                          let line = '';
                          seg.forEach((i, n) => {
                            const x = xOf(times[i]).toFixed(1);
                            const y = yOf(s.values[i] as number).toFixed(1);
                            if (n === 0) {
                              line += `M${x},${y}`;
                            } else if (s.step) {
                              const py = yOf(s.values[seg[n - 1]] as number).toFixed(1);
                              line += `L${x},${py}L${x},${y}`;
                            } else {
                              line += `L${x},${y}`;
                            }
                          });
                          const firstX = xOf(times[seg[0]]).toFixed(1);
                          const lastX = xOf(times[seg[seg.length - 1]]).toFixed(1);
                          return (
                            <g key={k}>
                              {s.area && (
                                <path
                                  d={`${line}L${lastX},${baseY}L${firstX},${baseY}Z`}
                                  fill={`url(#${uid}g${idx})`}
                                />
                              )}
                              <path
                                d={line}
                                fill="none"
                                stroke={s.color}
                                strokeWidth={s.width ?? 2}
                                strokeDasharray={s.dashed ? '5 4' : undefined}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>

                {/* Latest value markers */}
                {showLastDot &&
                  series.map((s) => {
                    const last = times.length - 1;
                    const v = s.values[last];
                    if (v === null || v === undefined) return null;
                    const cx = xOf(times[last]);
                    const cy = yOf(v);
                    return (
                      <g key={s.key}>
                        <circle cx={cx} cy={cy} r={7} fill={s.color} opacity={0.18} />
                        <circle cx={cx} cy={cy} r={3.5} fill={s.color} />
                      </g>
                    );
                  })}

                {/* Hover crosshair + points */}
                {active !== null && (
                  <g pointerEvents="none">
                    <line
                      x1={xOf(times[active])}
                      x2={xOf(times[active])}
                      y1={m.top}
                      y2={baseY}
                      className="stroke-slate-400 dark:stroke-slate-500"
                      strokeWidth={1}
                    />
                    {series.map((s) => {
                      const v = s.values[active];
                      if (v === null || v === undefined) return null;
                      return (
                        <circle
                          key={s.key}
                          cx={xOf(times[active])}
                          cy={yOf(v)}
                          r={4.5}
                          fill={s.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    })}
                  </g>
                )}

                <rect
                  x={m.left}
                  y={m.top}
                  width={plotW}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: 'crosshair', touchAction: 'none' }}
                  onPointerMove={handleMove}
                  onPointerDown={handleMove}
                  onPointerLeave={() => setActive(null)}
                />
              </svg>

              {active !== null && (
                <div
                  className="pointer-events-none absolute z-20 min-w-[120px] max-w-[190px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm text-[10px] sm:text-[11px]"
                  style={
                    xOf(times[active]) > m.left + plotW * 0.5
                      ? { top: m.top, right: Math.max(6, width - xOf(times[active]) + 10) }
                      : { top: m.top, left: Math.max(6, xOf(times[active]) + 10) }
                  }
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
                    {xMode === 'relative'
                      ? new Date(times[active]).toLocaleTimeString('tr-TR')
                      : new Date(times[active]).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                    {xMode === 'relative' && (
                      <span className="ml-1.5 font-normal text-slate-400">
                        {d1 - times[active] < 1500
                          ? '(şimdi)'
                          : `(${formatDuration(d1 - times[active])} önce)`}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {series.map((s) => {
                      const v = s.values[active];
                      return (
                        <div key={s.key} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.label}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {v === null || v === undefined ? '—' : (s.format ?? yFormat)(v)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {tooltipFooter && (
                    <div className="mt-1.5 border-t border-slate-200 dark:border-slate-700 pt-1.5 text-slate-500 dark:text-slate-400">
                      {tooltipFooter(active)}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
