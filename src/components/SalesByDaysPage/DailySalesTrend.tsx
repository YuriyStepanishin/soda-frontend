import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SalesByDaysRow } from '../../api/fetchSales';
import { dailyChartPoints, dailyChartDomain, type DailyChartMetric } from '../../utils/dailySalesChart';
import styles from './SalesByDaysPage.module.css';

const metrics: { key: DailyChartMetric; label: string; unit: string }[] = [
  { key: 'amount', label: 'Сума', unit: 'грн' },
  { key: 'storesCount', label: 'ТТ', unit: 'ТТ' },
  { key: 'weight', label: 'Вага', unit: 'кг' },
];
const fullNumber = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const shortNumber = new Intl.NumberFormat('uk-UA', { notation: 'compact', maximumFractionDigits: 1 });

export default function DailySalesTrend({ rows }: { rows: SalesByDaysRow[] }) {
  const [metric, setMetric] = useState<DailyChartMetric>('amount');
  const [grain, setGrain] = useState<'day' | 'week'>('day');
  const [focused, setFocused] = useState<string | null>(null);
  const titleId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(960);
  const points = useMemo(() => dailyChartPoints(rows, metric, grain), [rows, metric, grain]);
  const hasPoints = points.length > 0;
  useEffect(() => {
    if (!plotRef.current) return;
    const observer = new ResizeObserver(entries => setPlotWidth(Math.max(280, Math.round(entries[0].contentRect.width))));
    observer.observe(plotRef.current);
    return () => observer.disconnect();
  }, [hasPoints]);
  const { min, max } = dailyChartDomain(points);
  const current = metrics.find(item => item.key === metric)!;
  const timestamp = (date: string) => Date.parse(date + 'T00:00:00Z');
  const first = points[0] ? timestamp(points[0].date) : 0;
  const last = points.length ? timestamp(points[points.length - 1].date) : 0;
  const x = (date: string) => first === last ? (65 + plotWidth - 20) / 2 : 65 + (timestamp(date) - first) / (last - first) * (plotWidth - 85);
  const y = (value: number) => 238 - (value - min) / (max - min) * 208;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`).join(' ');
  const selected = points.find(point => point.date === focused);
  const labels = points.filter((_, index) => index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / (plotWidth < 600 ? 3 : 6))) === 0);
  return <section className={styles.trendPanel} aria-labelledby={titleId}>
    <div className={styles.trendHeader}>
      <div><h2 id={titleId}>Динаміка продажів</h2><p>Оберіть точку на графіку, щоб побачити значення</p></div>
      <div className={styles.chartControls} role="group" aria-label="Показник графіка">
        {metrics.map(item => <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => { setMetric(item.key); setFocused(null); }}>{item.label}</button>)}
      </div>
      <div className={styles.chartControls} role="group" aria-label="Періодичність графіка">
        <button type="button" aria-pressed={grain === 'day'} onClick={() => { setGrain('day'); setFocused(null); }}>Дні</button>
        <button type="button" aria-pressed={grain === 'week'} onClick={() => { setGrain('week'); setFocused(null); }}>Тижні</button>
      </div>
    </div>
    {points.length ? <>
      <div className={styles.trendValue} aria-live="polite">{selected ? `${selected.label}: ${fullNumber.format(selected.value)} ${current.unit}` : `${current.label}, ${current.unit}`}</div>
      <div ref={plotRef} className={styles.trendPlot}>
        <svg viewBox={`0 0 ${plotWidth} 285`} role="img" aria-label={`${current.label}: динаміка за ${grain === 'day' ? 'днями' : 'тижнями'}`} onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!rect.width || !points.length) return;
          const position = (event.clientX - rect.left) / rect.width * plotWidth;
          const nearest = points.reduce((best, point) => Math.abs(x(point.date) - position) < Math.abs(x(best.date) - position) ? point : best);
          setFocused(nearest.date);
        }}>
          <title>{`${current.label} за вибраний період. Точні значення також наведені в таблиці нижче.`}</title>
          {Array.from({ length: 5 }, (_, index) => {
            const value = min + (max - min) * index / 4;
            return <g key={index}><line x1="65" x2={plotWidth - 20} y1={y(value)} y2={y(value)} stroke="#dbe5f1" /><text x="53" y={y(value) + 4} textAnchor="end" fill="#425466" fontSize="12">{shortNumber.format(value)}</text></g>;
          })}
          <line x1="65" x2={plotWidth - 20} y1={y(0)} y2={y(0)} stroke="#92a7c0" />
          <path d={path} fill="none" stroke="#1769ce" strokeWidth="2.5" />
          {points.map(point => <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={focused === point.date ? 5 : 3} fill={point.value < 0 ? '#a32939' : '#1769ce'} tabIndex={0}
            aria-label={`${point.label}: ${fullNumber.format(point.value)} ${current.unit}`}
            onMouseEnter={() => setFocused(point.date)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(point.date)} onBlur={() => setFocused(null)}>
            <title>{`${point.label}: ${fullNumber.format(point.value)} ${current.unit}`}</title>
          </circle>)}
          {labels.map(point => <text key={point.date} x={x(point.date)} y="266" textAnchor="middle" fill="#425466" fontSize="12">{point.date.slice(8, 10)}.{point.date.slice(5, 7)}</text>)}
        </svg>
      </div>
      <p className={styles.chartNote}>Відображено лише отримані дати; проміжки між точками не є продажами. Тижневі значення — сума днів у вибраному періоді, у тому числі неповних тижнів.</p>
    </> : <p className={styles.chartNote}>Для цього періоду немає даних графіка.</p>}
  </section>;
}
