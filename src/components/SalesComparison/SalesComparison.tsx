import { useMemo, useState } from 'react';
import type { SalesReportResponse, SalesReportRow } from '../../api/fetchSales';
import { buildReportTree } from '../../utils/reportHierarchy';
import styles from './SalesComparison.module.css';

type Metric = 'stores' | 'quantity' | 'weight' | 'sku' | 'amount' | 'vmd';
type Props = {
  first: SalesReportResponse;
  second: SalesReportResponse;
  fields: string[];
  metrics: Record<Metric, boolean>;
  format: (value: number) => string;
  firstLabel: string;
  secondLabel: string;
};

const labels: Record<Metric, string> = {
  stores: 'АКБ', quantity: 'Кількість, шт', weight: 'Вага, кг',
  sku: 'SKU', amount: 'Сума, грн', vmd: 'ВМД, грн',
};
const metricKeys: Metric[] = ['stores', 'quantity', 'weight', 'sku', 'amount', 'vmd'];

export default function SalesComparison({ first, second, fields, metrics, format, firstLabel, secondLabel }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const active = metricKeys.filter(key => metrics[key]);
  const keyOf = (row: SalesReportRow) => fields.length && row.dimensions
    ? JSON.stringify(fields.slice(0, (row.level ?? 0) + 1).map(field => [field, row.dimensions?.[field] ?? null]))
    : row.id;

  const { tree, firstByKey, secondByKey } = useMemo(() => {
    const a = new Map(first.rows.map(row => [keyOf(row), row]));
    const b = new Map(second.rows.map(row => [keyOf(row), row]));
    const combined = [...first.rows, ...second.rows.filter(row => !a.has(keyOf(row)))];
    return { tree: buildReportTree(combined, fields), firstByKey: a, secondByKey: b };
  }, [first, second, fields]);

  const visible = useMemo(() => {
    const result: Array<{ row: (typeof tree)[number]; depth: number }> = [];
    const visit = (items: typeof tree, depth: number) => {
      for (const row of items) {
        result.push({ row, depth });
        if (!collapsed.has(row.treeId)) visit(row.subRows, depth + 1);
      }
    };
    visit(tree, 0);
    return result;
  }, [tree, collapsed]);

  const cell = (row: SalesReportRow | undefined, metric: Metric) => {
    if (metric === 'vmd' && (row?.vmd === null || row?.vmd === undefined)) return '—';
    return format(Number(row?.[metric] ?? 0));
  };
  const change = (a: SalesReportRow | undefined, b: SalesReportRow | undefined, metric: Metric) => {
    if (metric === 'vmd' && (a?.vmd == null || b?.vmd == null)) return '—';
    const current = Number(a?.[metric] ?? 0);
    const previous = Number(b?.[metric] ?? 0);
    const diff = current - previous;
    const percentage = previous === 0 ? (current === 0 ? '0%' : 'н/д') : `${diff > 0 ? '+' : ''}${format(diff / Math.abs(previous) * 100)}%`;
    return `${diff > 0 ? '+' : ''}${format(diff)} (${percentage})`;
  };
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Порівняння');
      sheet.addRow(['Період 1', firstLabel]);
      sheet.addRow(['Період 2', secondLabel]);
      sheet.addRow(['Назва', ...active.flatMap(metric => [labels[metric] + ' — 1', labels[metric] + ' — 2', labels[metric] + ' — різниця', labels[metric] + ' — %'])]);
      const write = (name: string, a: SalesReportRow | undefined, b: SalesReportRow | undefined) => {
        sheet.addRow([name, ...active.flatMap(metric => {
          const unknownVmd = metric === 'vmd' && (a?.vmd == null || b?.vmd == null);
          const one = unknownVmd ? null : Number(a?.[metric] ?? 0);
          const two = unknownVmd ? null : Number(b?.[metric] ?? 0);
          return [one, two, one == null || two == null ? null : one - two,
            one == null || two == null || two === 0 ? null : (one - two) / Math.abs(two) * 100];
        })]);
      };
      for (const { row, depth } of visible) write('  '.repeat(depth) + row.label, firstByKey.get(keyOf(row)), secondByKey.get(keyOf(row)));
      write('Разом', first.totals, second.totals);
      sheet.getRow(3).font = { bold: true };
      sheet.getRow(sheet.rowCount).font = { bold: true };
      sheet.getColumn(1).width = 42;
      for (let index = 2; index <= sheet.columnCount; index++) sheet.getColumn(index).width = 17;
      const data = await workbook.xlsx.writeBuffer();
      const blob = new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'SODA-Порівняння-продажів.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Помилка експорту Excel');
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className={styles.wrapper}>
      <h3>Порівняння періодів</h3>
      <button type="button" onClick={() => void exportExcel()} disabled={exporting}>{exporting ? 'Готуємо Excel…' : 'Зберегти Excel'}</button>
      {exportError && <p role="alert">{exportError}</p>}
      <p className={styles.hint}>Період 1: {firstLabel} · Період 2: {secondLabel}. Різниця = період 1 − період 2.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr><th rowSpan={2}>Назва</th>{active.map(metric => <th key={metric} colSpan={3}>{labels[metric]}</th>)}</tr>
            <tr>{active.map(metric => [
              <th key={metric + '-a'}>Період 1</th>,
              <th key={metric + '-b'}>Період 2</th>,
              <th key={metric + '-delta'}>Різниця / %</th>,
            ])}</tr>
          </thead>
          <tbody>
            {visible.map(({ row, depth }) => {
              const a = firstByKey.get(keyOf(row));
              const b = secondByKey.get(keyOf(row));
              return <tr key={row.treeId}>
                <td><div className={styles.name} style={{ paddingLeft: Math.min(depth, 8) * 12 }}>
                  {row.subRows.length > 0 && <button type="button" aria-expanded={!collapsed.has(row.treeId)}
                    onClick={() => setCollapsed(prev => { const next = new Set(prev); if (next.has(row.treeId)) next.delete(row.treeId); else next.add(row.treeId); return next; })}>
                    {collapsed.has(row.treeId) ? '+' : '−'}
                  </button>}
                  {row.label}
                </div></td>
                {active.map(metric => [
                  <td key={metric + '-a'}>{cell(a, metric)}</td>,
                  <td key={metric + '-b'}>{cell(b, metric)}</td>,
                  <td key={metric + '-delta'}>{change(a, b, metric)}</td>,
                ])}
              </tr>;
            })}
            {!visible.length && <tr><td colSpan={1 + active.length * 3}>Немає даних за вибрані періоди.</td></tr>}
          </tbody>
          <tfoot><tr><th>Разом</th>{active.map(metric => [
            <td key={metric + '-a'}>{cell(first.totals, metric)}</td>,
            <td key={metric + '-b'}>{cell(second.totals, metric)}</td>,
            <td key={metric + '-delta'}>{change(first.totals, second.totals, metric)}</td>,
          ])}</tr></tfoot>
        </table>
      </div>
    </section>
  );
}
