interface StatChipProps {
  label: string;
  value: string;
  /** Tailwind text color classes for the value. */
  tone?: string;
  hint?: string;
}

export function StatChip({ label, value, tone, hint }: StatChipProps) {
  return (
    <div
      title={hint}
      className="rounded-xl border border-slate-200/80 dark:border-slate-800/70 bg-slate-50 dark:bg-slate-950/50 px-3 py-2 min-w-0"
    >
      <span className="block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`block truncate font-mono text-sm font-bold ${
          tone ?? 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
