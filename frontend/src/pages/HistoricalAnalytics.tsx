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
import { TimeSeriesChart, PERCENT_BANDS, PERCENT_TICKS } from '../components/TimeSeriesChart';
import type { ChartSeries } from '../components/TimeSeriesChart';

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
      setError(err?.message || 'Geçmiş veriler alınamadı.');
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

  // Timestamps for time series charts
  const times = useMemo(() => points.map((p) => p.timestamp), [points]);

  // CPU Series: Average and Max peak
  const cpuSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'cpu_avg',
        label: 'Ort. CPU (%)',
        color: '#06b6d4', // Cyan
        values: points.map((p) => p.cpu_percent),
        area: true,
        width: 2.5,
        format: (v) => `%${v.toFixed(1)}`,
      },
      {
        key: 'cpu_max',
        label: 'Tepe (Max)',
        color: '#f59e0b', // Amber
        values: points.map((p) => p.cpu_max),
        dashed: true,
        width: 1.5,
        format: (v) => `%${v.toFixed(1)}`,
      },
    ],
    [points]
  );

  // RAM Series: Memory percent
  const memSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'memory_percent',
        label: 'RAM Kullanımı (%)',
        color: '#8b5cf6', // Violet
        values: points.map((p) => p.memory_percent),
        area: true,
        width: 2.5,
        format: (v) => `%${v.toFixed(1)}`,
      },
    ],
    [points]
  );

  // Network Series: Download (RX) & Upload (TX)
  const netSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'net_rx',
        label: 'İndirme (RX)',
        color: '#10b981', // Emerald
        values: points.map((p) => p.net_recv_speed),
        area: true,
        width: 2,
        format: (v) => formatSpeed(v),
      },
      {
        key: 'net_tx',
        label: 'Gönderme (TX)',
        color: '#3b82f6', // Blue
        values: points.map((p) => p.net_sent_speed),
        width: 2,
        format: (v) => formatSpeed(v),
      },
    ],
    [points]
  );

  // Load & Container Series
  const loadSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'load_1',
        label: 'Load (1 dk)',
        color: '#f59e0b', // Amber
        values: points.map((p) => p.load_1),
        width: 2.5,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'containers',
        label: 'Konteyner',
        color: '#6366f1', // Indigo
        values: points.map((p) => p.containers_running),
        dashed: true,
        step: true,
        width: 1.5,
        format: (v) => `${v} adet`,
      },
    ],
    [points]
  );

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
                Ölçekli eksenler, tehlike bölgeleri ve zaman çizelgesiyle sunucu telemetrisi
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
                %{summary.avg_cpu}
              </span>
              <span className="text-[11px] text-slate-400">ort.</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
              <span>Zirve (Peak):</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono font-semibold">
                %{summary.max_cpu}
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
                %{summary.avg_memory}
              </span>
              <span className="text-[11px] text-slate-400">ort.</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
              <span>Maksimum RAM:</span>
              <strong className="text-violet-600 dark:text-violet-400 font-mono font-semibold">
                %{summary.max_memory}
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
                %{summary.avg_disk}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Synchronized Hover Inspector Banner */}
      {hoveredPoint && (
        <div className="bg-indigo-50/70 dark:bg-slate-950/80 border border-indigo-200/80 dark:border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold font-sans">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(hoveredPoint.timestamp).toLocaleString('tr-TR')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
            <span>
              CPU: <strong className="text-cyan-600 dark:text-cyan-400">%{hoveredPoint.cpu_percent}</strong>
              {hoveredPoint.cpu_max > hoveredPoint.cpu_percent && (
                <span className="text-slate-400 text-[11px]"> (Zirve: %{hoveredPoint.cpu_max})</span>
              )}
            </span>
            <span>•</span>
            <span>
              RAM: <strong className="text-violet-600 dark:text-violet-400">%{hoveredPoint.memory_percent}</strong> ({formatBytes(hoveredPoint.memory_used)})
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
              Konteyner: <strong className="text-indigo-600 dark:text-indigo-400">{hoveredPoint.containers_running}</strong>
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

      {/* Main Charts Grid: Fully Modernized TimeSeries Charts */}
      {points.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Chart 1: CPU History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
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

            <div className="w-full bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <TimeSeriesChart
                times={times}
                series={cpuSeries}
                height={220}
                yMax={100}
                yTicks={PERCENT_TICKS}
                yFormat={(v) => `%${v}`}
                bands={PERCENT_BANDS}
                xMode="clock"
                activeIndex={hoverIndex}
                onActiveIndexChange={setHoverIndex}
                emptyText="CPU geçmiş verisi bulunamadı"
              />
            </div>
          </div>

          {/* Chart 2: Memory History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
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
                Ort. %{summary?.avg_memory}
              </div>
            </div>

            <div className="w-full bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <TimeSeriesChart
                times={times}
                series={memSeries}
                height={220}
                yMax={100}
                yTicks={PERCENT_TICKS}
                yFormat={(v) => `%${v}`}
                bands={PERCENT_BANDS}
                xMode="clock"
                activeIndex={hoverIndex}
                onActiveIndexChange={setHoverIndex}
                tooltipFooter={(idx) =>
                  points[idx] ? (
                    <div>Kullanılan: {formatBytes(points[idx].memory_used)}</div>
                  ) : null
                }
                emptyText="RAM geçmiş verisi bulunamadı"
              />
            </div>
          </div>

          {/* Chart 3: Network Throughput History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
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
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-emerald-500 rounded"></span> ↓ İndirme (RX)
                </span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-blue-500 rounded"></span> ↑ Gönderme (TX)
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <TimeSeriesChart
                times={times}
                series={netSeries}
                height={220}
                yBase={1024}
                yAutoFloor={1024}
                yFormat={(v) => formatSpeed(v)}
                xMode="clock"
                activeIndex={hoverIndex}
                onActiveIndexChange={setHoverIndex}
                emptyText="Ağ geçmiş verisi bulunamadı"
              />
            </div>
          </div>

          {/* Chart 4: Load Average & Containers History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Sistem Yükü & Konteynerler
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    1 Dakikalık Çekirdek Yük Ortalaması ve Aktif Docker Konteynerler
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-amber-500 rounded"></span> Load (1 dk)
                </span>
                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-indigo-500 rounded"></span> Konteyner
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <TimeSeriesChart
                times={times}
                series={loadSeries}
                height={220}
                yAutoFloor={1}
                yFormat={(v) => v.toFixed(1)}
                xMode="clock"
                activeIndex={hoverIndex}
                onActiveIndexChange={setHoverIndex}
                emptyText="Sistem yükü geçmiş verisi bulunamadı"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
