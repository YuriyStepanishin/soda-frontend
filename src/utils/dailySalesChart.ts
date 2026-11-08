import type { SalesByDaysRow } from '../api/fetchSales';

export type DailyChartMetric = 'amount' | 'weight' | 'storesCount';
export type DailyChartPoint = { date: string; label: string; value: number };

export function dailyChartPoints(rows: SalesByDaysRow[], metric: DailyChartMetric, grain: 'day' | 'week'): DailyChartPoint[] {
  const points = new Map<string, DailyChartPoint>();
  for (const row of rows) {
    if (row[metric] == null) continue;
    const value = Number(row[metric]);
    if (!Number.isFinite(value)) continue;
    const key = grain === 'day' ? row.date : `${row.week_year}-W${String(row.week_number).padStart(2, '0')}`;
    const point = points.get(key);
    if (point) {
      point.value += value;
      if (row.date < point.date) point.date = row.date;
    } else points.set(key, { date: row.date, label: grain === 'day' ? row.date : `Тиждень ${row.week_number} / ${row.week_year}`, value });
  }
  return [...points.values()].sort((first, second) => first.date.localeCompare(second.date));
}

export function dailyChartDomain(points: DailyChartPoint[]) {
  let min = 0;
  let max = 0;
  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  return { min, max: max === min ? min + 1 : max };
}
