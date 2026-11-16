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
  agentLabel: string;
};

const labels: Record<Metric, string> = {
  stores: 'АКБ', quantity: 'Кількість, шт', weight: 'Вага, кг',
  sku: 'SKU', amount: 'Сума, грн', vmd: 'ВМД, грн',
};
const metricKeys: Metric[] = ['stores', 'quantity', 'weight', 'sku', 'amount', 'vmd'];

export default function SalesComparison({ first, second, fields, metrics, format, firstLabel, secondLabel, agentLabel }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const active = metricKeys.filter(key => metrics[key]);
  const shortDate = (value: string) => value.replace(/(\\d{4})-(\\d{2})-(\\d{2})/g, '$3.$2.$1');
  const firstDates = shortDate(firstLabel);
  const secondDates = shortDate(secondLabel);
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
    if (metric === 'vmd' && row && row.vmd == null) return '—';
    return format(Number(row?.[metric] ?? 0));
  };
  const change = (a: SalesReportRow | undefined, b: SalesReportRow | undefined, metric: Metric) => {
    if (metric === 'vmd' && ((a && a.vmd == null) || (b && b.vmd == null))) return '—';
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
      sheet.addRow(['Перший період', firstDates]);
      sheet.addRow(['Другий період', secondDates]);
      sheet.addRow(['Назва', ...active.flatMap(metric => [labels[metric] + ' — ' + firstDates, labels[metric] + ' — ' + secondDates, labels[metric] + ' — різниця', labels[metric] + ' — %'])]);
      const write = (name: string, a: SalesReportRow | undefined, b: SalesReportRow | undefined, depth = 0, total = false) => {
        const excelRow = sheet.addRow([name, ...active.flatMap(metric => {
          // A missing row means zero sales, not an unknown VMD.
          // Keep an explicit null only when the backend actually reports unknown VMD.
          const one = metric === 'vmd' && a && a.vmd == null ? null : Number(a?.[metric] ?? 0);
          const two = metric === 'vmd' && b && b.vmd == null ? null : Number(b?.[metric] ?? 0);
          return [one, two, one == null || two == null ? null : one - two,
            one == null || two == null || two === 0 ? null : (one - two) / Math.abs(two) * 100];
        })]);
        excelRow.height = total ? 27 : 22;
        excelRow.alignment = { vertical: 'middle' };
        excelRow.getCell(1).alignment = { vertical: 'middle', indent: Math.min(depth, 8) };
        const baseColor = total ? 'FF17324D' : depth === 0 ? 'FFEAF1F8' : excelRow.number % 2 ? 'FFFFFFFF' : 'FFF7F9FC';
        excelRow.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseColor } };
          cell.font = { bold: total || depth === 0, color: { argb: total ? 'FFFFFFFF' : 'FF233247' } };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDE5ED' } } };
          if (cell.col > 1 && typeof cell.value === 'number') cell.numFmt = (cell.col - 1) % 4 === 3 ? '0.0"%"' : '#,##0.00;[Red](#,##0.00);–';
        });
        active.forEach((_, index) => {
          for (const offset of [2, 3]) {
            const cell = excelRow.getCell(2 + index * 4 + offset);
            const value = cell.value;
            if (!total && typeof value === 'number' && value !== 0) {
              const positive = value > 0;
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: positive ? 'FFDDF4E5' : 'FFFFE1E1' } };
              cell.font = { bold: true, color: { argb: positive ? 'FF17683B' : 'FFA52A2A' } };
            }
          }
        });
      };
      for (const { row, depth } of visible) write(row.label, firstByKey.get(keyOf(row)), secondByKey.get(keyOf(row)), depth);
      write('Разом', first.totals, second.totals, 0, true);
      for (const index of [1, 2]) {
        sheet.getRow(index).font = { bold: true, color: { argb: 'FF17324D' } };
      }
      const header = sheet.getRow(3);
      header.height = 42;
      header.alignment = { vertical: 'middle', wrapText: true };
      header.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24547A' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });
      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
      sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: sheet.rowCount - 1, column: sheet.columnCount } };

      sheet.getColumn(1).width = 42;
      for (let index = 2; index <= sheet.columnCount; index++) sheet.getColumn(index).width = 17;
      const data = await workbook.xlsx.writeBuffer();
      const blob = new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safePart = (value: string) => value.replace(/[\\/:*?"<>|\\x00-\\x1F]/g, '-').replace(/\\s+/g, ' ').trim().slice(0, 85);
      link.download = `Порівняння-${safePart(agentLabel || 'Усі торгові агенти')}-${safePart(firstLabel)}_vs_${safePart(secondLabel)}.xlsx`;
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
      <p className={styles.hint}>{firstDates} · {secondDates}. Різниця = перший період − другий період.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr><th rowSpan={2}>Назва</th>{active.map(metric => <th key={metric} colSpan={3}>{labels[metric]}</th>)}</tr>
            <tr>{active.map(metric => [
              <th key={metric + '-a'}>{firstDates}</th>,
              <th key={metric + '-b'}>{secondDates}</th>,
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
