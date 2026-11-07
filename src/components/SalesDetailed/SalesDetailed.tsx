import { buildReportTree } from '../../utils/reportHierarchy';
import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table';
import styles from './SalesDetailed.module.css';

type MetricKey = 'quantity' | 'stores' | 'weight' | 'amount' | 'sku';

type MetricState = Record<MetricKey, boolean>;

type DetailedRow = {
  id: string;
  label: string;
  level?: number;
  dimensions?: Record<string, string>;
  quantity: number;
  stores: number;
  weight: number;
  amount: number;
  sku: number;
};

type Props = {
  rows: DetailedRow[];
  totals: DetailedRow;
  metrics: MetricState;
  format: (value: number) => string;
  title: string;
  reportMeta?: string[];
  hierarchyFields?: string[];
  onVisibleRowsChange?: (rows: DetailedRow[], source: DetailedRow[]) => void;
};

export default function SalesDetailed({
  rows,
  totals,
  metrics,
  format,
  title,
  reportMeta = [],
  hierarchyFields = [],
  onVisibleRowsChange,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const tree = useMemo(() => buildReportTree(rows, hierarchyFields), [rows, hierarchyFields]);

  const columns = useMemo<ColumnDef<(typeof tree)[number]>[]>(() => {
    const metricColumns = [
      { key: 'stores', label: 'АКБ' },
      { key: 'quantity', label: 'Кількість, шт' },
      { key: 'weight', label: 'Вага' },
      { key: 'sku', label: 'SKU' },
      { key: 'amount', label: 'Сума, грн' },
    ]
      .filter(column => metrics[column.key as MetricKey])
      .map<ColumnDef<(typeof tree)[number]>>(column => ({
        id: column.key,
        accessorFn: row => row[column.key as MetricKey],
        header: column.label,
        cell: info => {
          const value = Number(info.getValue() ?? 0);
          return column.key === 'stores' ? value : format(value);
        },
        footer: () => {
          const value = totals[column.key as MetricKey] ?? 0;
          return column.key === 'stores' ? value : format(value);
        },
      }));

    return [
      {
        accessorKey: 'label',
        header: 'Назва',
        cell: info => {
          const level = info.row.original.level ?? 0;
          return (
            <span
                className={`${styles.label} ${styles[`level${Math.min(level, 4)}`]}`}
              style={{ paddingLeft: `${Math.min(level, 4) * 14}px` }}
            >
              {info.row.getCanExpand() ? (
                <button type="button" className={styles.expandButton}
                  aria-label={`${info.row.getIsExpanded() ? 'Згорнути' : 'Розгорнути'} ${info.row.original.label}`}
                  aria-expanded={info.row.getIsExpanded()}
                  onClick={info.row.getToggleExpandedHandler()}>
                  {info.row.getIsExpanded() ? '−' : '+'}
                </button>
              ) : null}
              {String(info.getValue())}
            </span>
          );
        },
        footer: 'Разом',
      },
      ...metricColumns,
    ];
  }, [format, metrics, totals]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tree,
    getSubRows: row => row.subRows,
    getRowId: row => row.treeId,
    columns,
    state: { sorting, expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  useEffect(() => {
    // Export the complete sorted tree, including groups collapsed on screen.
    const sorted: DetailedRow[] = [];
    const visit = (items: Row<(typeof tree)[number]>[]) => {
      for (const item of items) {
        sorted.push(item.original);
        visit(item.subRows);
      }
    };
    visit(table.getSortedRowModel().rows);
    onVisibleRowsChange?.(sorted, rows);
  }, [onVisibleRowsChange, rows, sorting, table, tree]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>{title}</div>
        {reportMeta.length ? (
          <div className={styles.headerMeta}>
            {reportMeta.map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>

      {tree.some(row => row.subRows.length) ? (
        <div className={styles.treeActions}>
          <button type="button" onClick={() => table.toggleAllRowsExpanded(true)}>Розгорнути все</button>
          <button type="button" onClick={() => table.toggleAllRowsExpanded(false)}>Згорнути все</button>
        </div>
      ) : null}
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const sortState = header.column.getIsSorted();

                return (
                  <th
                    key={header.id}
                    className={
                      header.column.getCanSort() ? styles.sortableHeader : ''
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {sortState ? (
                      <span className={styles.sortMarker}>
                        {sortState === 'asc' ? '↑' : '↓'}
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className={styles.emptyCell} colSpan={columns.length}>
                Немає даних для вибраних фільтрів
              </td>
            </tr>
          )}
        </tbody>

        <tfoot>
          {table.getFooterGroups().map(footerGroup => (
            <tr className={styles.totalRow} key={footerGroup.id}>
              {footerGroup.headers.map(header => (
                <td key={header.id}>
                  <b>
                    {flexRender(
                      header.column.columnDef.footer,
                      header.getContext()
                    )}
                  </b>
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
