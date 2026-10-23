import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  HardDrive,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import type { MetricsHistoryResponse } from '../types';
import { api } from '../services/api';
import { formatBytes, formatSpeed } from '../utils/format';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

interface RangeOption {
  key: TimeRange;
  label: string;
  intervalDesc: string;
}

const RANGE_OPTIONS: RangeOption[] = [
  { key: '1h', label: 'Son 1 Saat', intervalDesc: '15 saniye aralıklarla' },
  { key: '6h', label: 'Son 6 Saat', intervalDesc: '1 dakika aralıklarla' },
  { key: '24h', label: 'Son 24 Saat', intervalDesc: '5 dakika aralıklarla' },
  { key: '7d', label: 'Son 7 Gün', intervalDesc: '30 dakika aralıklarla' },
  { key: '30d', label: 'Son 30 Gün', intervalDesc: '2 saat aralıklarla' },
];

export const HistoricalAnalytics: React.FC = () => {
  const [range, setRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<MetricsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const fetchHistory = async (selectedRange: TimeRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMetricsHistory(selectedRange);
      setData(res);
      setHoverIndex(null);
    } catch (err: any) {
      setError(err.message || 'Geçmiş veriler alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(range);
  }, [range]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data || !data.data.length) return;
    const headers = [
      'Tarih Saat',
      'CPU Ort (%)',
      'CPU Maks (%)',
      'RAM (%)',
      'RAM Kullanılan (Byte)',
      'Disk (%)',
      'Indirme Hizi (B/s)',
      'Yukleme Hizi (B/s)',
      'Load Average 1m',
      'Calisan Konteyner',
    ];
    const rows = data.data.map((p) => [
      new Date(p.timestamp).toLocaleString('tr-TR'),
      p.cpu_percent,
      p.cpu_max,
      p.memory_percent,
      p.memory_used,
      p.disk_used_percent,
      p.net_recv_speed,
      p.net_sent_speed,
      p.load_1,
      p.containers_running,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sentinel-metrics-${range}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-metrics-${range}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const points = data?.data || [];
  const summary = data?.summary;

  const hoveredPoint =
    hoverIndex !== null && points[hoverIndex]
      ? points[hoverIndex]
      : points.length > 0
      ? points[points.length - 1]
      : null;

  // Chart coordinate helpers
  const svgWidth = 800;
  const svgHeight = 180;
  const padding = { top: 20, right: 15, bottom: 25, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const cpuPath = useMemo(() => {
    if (!points.length) return { path: '', area: '', maxPath: '' };
    const stepX = graphWidth / Math.max(points.length - 1, 1);

    const pts = points.map((p, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - p.cpu_percent / 100) * graphHeight;
      const maxY = padding.top + (1 - p.cpu_max / 100) * graphHeight;
      return { x, y, maxY };
    });

    const path = pts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );
    const maxPath = pts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.maxY}` : `${acc} L ${pt.x} ${pt.maxY}`),
      ''
    );
    const area = `${path} L ${pts[pts.length - 1].x} ${padding.top + graphHeight} L ${
      pts[0].x
    } ${padding.top + graphHeight} Z`;

    return { path, area, maxPath };
  }, [points, graphWidth, graphHeight]);

  const memPath = useMemo(() => {
    if (!points.length) return { path: '', area: '' };
    const stepX = graphWidth / Math.max(points.length - 1, 1);

    const pts = points.map((p, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - p.memory_percent / 100) * graphHeight;
      return { x, y };
    });

    const path = pts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );
    const area = `${path} L ${pts[pts.length - 1].x} ${padding.top + graphHeight} L ${
      pts[0].x
    } ${padding.top + graphHeight} Z`;

    return { path, area };
  }, [points, graphWidth, graphHeight]);

  const netPath = useMemo(() => {
    if (!points.length) return { rxPath: '', txPath: '', maxSpeed: 1024 };
    const stepX = graphWidth / Math.max(points.length - 1, 1);

    let maxSpeed = 1024;
    points.forEach((p) => {
      if (p.net_recv_speed > maxSpeed) maxSpeed = p.net_recv_speed;
      if (p.net_sent_speed > maxSpeed) maxSpeed = p.net_sent_speed;
    });

    const rxPts = points.map((p, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - p.net_recv_speed / maxSpeed) * graphHeight;
      return { x, y };
    });

    const txPts = points.map((p, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + (1 - p.net_sent_speed / maxSpeed) * graphHeight;
      return { x, y };
    });

    const rxPath = rxPts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );
    const txPath = txPts.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );

    return { rxPath, txPath, maxSpeed };
  }, [points, graphWidth, graphHeight]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgRelativeX = (clientX / rect.width) * svgWidth;
    const xInGraph = svgRelativeX - padding.left;

    if (xInGraph < 0 || xInGraph > graphWidth) return;
    const ratio = xInGraph / graphWidth;
    const idx = Math.min(Math.max(Math.round(ratio * (points.length - 1)), 0), points.length - 1);
    setHoverIndex(idx);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Range Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Geçmiş Metrik Trendleri & Analiz
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (SQLite Veritabanı Kayıtları)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Geçmişe dönük CPU, RAM, Disk, Ağ ve Konteyner telemetrisi
              </p>
            </div>
          </div>
        </div>

        {/* Range Buttons & Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Time Range Pills */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  range === opt.key
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title={opt.intervalDesc}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchHistory(range)}
            disabled={loading}
            title="Yenile"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportCSV}
              disabled={!points.length}
              title="CSV Raporu İndir"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              disabled={!points.length}
              title="JSON Verisi İndir"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Highlight Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Peak & Avg CPU */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">İşlemci (CPU)</span>
              <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-cyan-300">
                {summary.avg_cpu}%
              </span>
              <span className="text-[11px] text-slate-400">ort.</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
              <span>Zirve (Peak):</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono font-semibold">
                {summary.max_cpu}%
              </strong>
            </div>
          </div>

          {/* Card 2: Peak & Avg RAM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Bellek (RAM)</span>
              <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-violet-300">
                {summary.avg_memory}%
              </span>
              <span className="text-[11px] text-slate-400">ort.</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
              <span>Maksimum RAM:</span>
              <strong className="text-violet-600 dark:text-violet-400 font-mono font-semibold">
                {summary.max_memory}%
              </strong>
            </div>
          </div>

          {/* Card 3: Network Transfer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ağ Transferi</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-emerald-400">
                {formatBytes(summary.total_net_recv_bytes + summary.total_net_sent_bytes)}
              </span>
              <span className="text-[11px] text-slate-400">toplam</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">↓ {formatBytes(summary.total_net_recv_bytes)}</span>
              <span className="text-blue-600 dark:text-blue-400">↑ {formatBytes(summary.total_net_sent_bytes)}</span>
            </div>
          </div>

          {/* Card 4: Load & Storage */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sistem Yükü (Load)</span>
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-amber-400">
                {summary.max_load.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400">zirve</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
              <span>Ort. Kök Disk:</span>
              <strong className="text-slate-700 dark:text-slate-300 font-mono font-semibold">
                {summary.avg_disk}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Hover Inspection Inspector Bar */}
      {hoveredPoint && (
        <div className="bg-indigo-50/70 dark:bg-slate-950/80 border border-indigo-200/80 dark:border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold font-sans">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(hoveredPoint.timestamp).toLocaleString('tr-TR')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
            <span>
              CPU: <strong className="text-cyan-600 dark:text-cyan-400">{hoveredPoint.cpu_percent}%</strong>
              {hoveredPoint.cpu_max > hoveredPoint.cpu_percent && (
                <span className="text-slate-400 text-[11px]"> (Zirve: {hoveredPoint.cpu_max}%)</span>
              )}
            </span>
            <span>•</span>
            <span>
              RAM: <strong className="text-violet-600 dark:text-violet-400">{hoveredPoint.memory_percent}%</strong> ({formatBytes(hoveredPoint.memory_used)})
            </span>
            <span>•</span>
            <span>
              Ağ: <strong className="text-emerald-600 dark:text-emerald-400">↓ {formatSpeed(hoveredPoint.net_recv_speed)}</strong> / <strong className="text-blue-600 dark:text-blue-400">↑ {formatSpeed(hoveredPoint.net_sent_speed)}</strong>
            </span>
            <span>•</span>
            <span>
              Load: <strong className="text-amber-600 dark:text-amber-400">{hoveredPoint.load_1}</strong>
            </span>
            <span>•</span>
            <span>
              Konteyner: <strong className="text-blue-600 dark:text-blue-400">{hoveredPoint.containers_running}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && points.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Clock className="w-8 h-8 text-indigo-500 animate-pulse mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Geçmiş Kayıtlar Henüz Toplanıyor
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            Sentinel geçmiş kaydedici (recorder) arka planda 15 saniyede bir otomatik telemetri almaktadır. Birkaç dakika içinde grafikler oluşacaktır.
          </p>
        </div>
      )}

      {/* Main Charts Grid */}
      {points.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Chart 1: CPU History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    CPU Kullanım Trendi (%)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ortalama & Maksimum Tepe Noktaları
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-cyan-500 rounded"></span> Ort. CPU
                </span>
                <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
                  <span className="w-2.5 h-0.5 bg-amber-500 rounded"></span> Tepe (Max)
                </span>
              </div>
            </div>

            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-44 overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="cpuHistGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map((val) => {
                  const y = padding.top + (1 - val / 100) * graphHeight;
                  return (
                    <g key={val}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] fill-slate-400 font-mono"
                      >
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* Filled Area */}
                {cpuPath.area && <path d={cpuPath.area} fill="url(#cpuHistGrad)" />}

                {/* Max Peak Line */}
                {cpuPath.maxPath && (
                  <path
                    d={cpuPath.maxPath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* Avg CPU Line */}
                {cpuPath.path && (
                  <path
                    d={cpuPath.path}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover line indicator */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <line
                    x1={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y1={padding.top}
                    x2={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y2={padding.top + graphHeight}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Chart 2: Memory History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    RAM Bellek Tüketim Trendi (%)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Fiziksel RAM Kullanım Yüzdesi
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono text-violet-600 dark:text-violet-400 font-semibold">
                Ort. {summary?.avg_memory}%
              </div>
            </div>

            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-44 overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="memHistGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map((val) => {
                  const y = padding.top + (1 - val / 100) * graphHeight;
                  return (
                    <g key={val}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] fill-slate-400 font-mono"
                      >
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* Filled Area */}
                {memPath.area && <path d={memPath.area} fill="url(#memHistGrad)" />}

                {/* Memory Line */}
                {memPath.path && (
                  <path
                    d={memPath.path}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover line */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <line
                    x1={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y1={padding.top}
                    x2={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y2={padding.top + graphHeight}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Chart 3: Network Throughput History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Ağ Hız Trendi (RX / TX)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Saniyede İndirilen (Download) ve Gönderilen (Upload) Hızlar
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  ↓ İndirme (RX)
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  ↑ Gönderme (TX)
                </span>
              </div>
            </div>

            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-44 overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Grid Lines */}
                {[0, 0.5, 1].map((ratio) => {
                  const y = padding.top + (1 - ratio) * graphHeight;
                  const speedVal = netPath.maxSpeed * ratio;
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[9px] fill-slate-400 font-mono"
                      >
                        {formatSpeed(speedVal)}
                      </text>
                    </g>
                  );
                })}

                {/* RX Path */}
                {netPath.rxPath && (
                  <path
                    d={netPath.rxPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* TX Path */}
                {netPath.txPath && (
                  <path
                    d={netPath.txPath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover line */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <line
                    x1={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y1={padding.top}
                    x2={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y2={padding.top + graphHeight}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Chart 4: Load Average & Containers History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Sistem Yükü (Load Average)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    1 Dakikalık Çekirdek Yük Ortalaması
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                Zirve: {summary?.max_load.toFixed(2)}
              </div>
            </div>

            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-44 overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Grid Lines */}
                {[0, 0.5, 1].map((ratio) => {
                  const y = padding.top + (1 - ratio) * graphHeight;
                  const maxLoad = Math.max(summary?.max_load || 1, 1);
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] fill-slate-400 font-mono"
                      >
                        {(maxLoad * ratio).toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Load Path */}
                {(() => {
                  if (!points.length) return null;
                  const stepX = graphWidth / Math.max(points.length - 1, 1);
                  const maxLoad = Math.max(summary?.max_load || 1, 1);
                  const pts = points.map((p, i) => ({
                    x: padding.left + i * stepX,
                    y: padding.top + (1 - Math.min(p.load_1 / maxLoad, 1)) * graphHeight,
                  }));
                  const path = pts.reduce(
                    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                    ''
                  );
                  return (
                    <path
                      d={path}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })()}

                {/* Hover line */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <line
                    x1={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y1={padding.top}
                    x2={padding.left + hoverIndex * (graphWidth / Math.max(points.length - 1, 1))}
                    y2={padding.top + graphHeight}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
