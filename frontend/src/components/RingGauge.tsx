import { getStatusHex, getStatusLabel } from '../utils/format';

interface RingGaugeProps {
  /** 0-100 */
  value: number;
  size?: number;
  caption?: string;
}

/** 270° gauge: the colored arc fills up as usage grows; the label states the health in words. */
export function RingGauge({ value, size = 132, caption }: RingGaugeProps) {
  const v = Math.min(100, Math.max(0, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const color = getStatusHex(v);
  const center = size / 2;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size * 0.88 }}
      role="img"
      aria-label={`${caption ?? 'Kullanım'}: yüzde ${v.toFixed(1)}, durum ${getStatusLabel(v)}`}
    >
      <svg width={size} height={size} className="absolute left-0 top-0 overflow-visible">
        <g transform={`rotate(135 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={`${Math.max((arc * v) / 100, 0.01)} ${c}`}
            style={{ transition: 'stroke-dasharray 400ms ease, stroke 400ms ease' }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: size * 0.06 }}>
        <div className="font-mono font-extrabold leading-none text-slate-900 dark:text-white" style={{ fontSize: size * 0.27 }}>
          {v.toFixed(v >= 100 ? 0 : 1)}
          <span className="ml-0.5 text-slate-400" style={{ fontSize: size * 0.12 }}>
            %
          </span>
        </div>
        <span
          className="mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
          style={{ color, backgroundColor: `${color}22` }}
        >
          {getStatusLabel(v)}
        </span>
        {caption && <span className="mt-1 text-[10px] text-slate-400">{caption}</span>}
      </div>
    </div>
  );
}
