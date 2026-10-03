import { Fragment, useMemo, useState } from 'react';
import type { LaskaHierarchyRow } from '../../api/fetchLaskaSales';
import tableStyles from '../SalesDetailed/SalesDetailed.module.css';
import styles from './LaskaHierarchyTable.module.css';

type Props = { rows: LaskaHierarchyRow[]; format: (value: number) => string };
type Totals = Pick<LaskaHierarchyRow, 'quantity' | 'weight' | 'amount' | 'sku' | 'stores'>;

const sumRows = (rows: LaskaHierarchyRow[]): Totals => ({
  quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
  weight: rows.reduce((sum, row) => sum + row.weight, 0),
  amount: rows.reduce((sum, row) => sum + row.amount, 0),
  sku: rows.reduce((sum, row) => sum + row.sku, 0),
  stores: rows.reduce((sum, row) => sum + row.stores, 0),
});

export default function LaskaHierarchyTable({ rows, format }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const result = new Map<string, Map<string, LaskaHierarchyRow[]>>();
    rows.forEach(row => {
      const subgroups = result.get(row.group) ?? new Map<string, LaskaHierarchyRow[]>();
      const products = subgroups.get(row.subgroup) ?? [];
      products.push(row);
      subgroups.set(row.subgroup, products);
      result.set(row.group, subgroups);
    });
    return result;
  }, [rows]);

  const toggle = (set: Set<string>, key: string, update: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };

  const cells = (totals: Totals) => (
    <>
      <td>{format(totals.quantity)}</td>
      <td>{format(totals.weight)}</td>
      <td>{format(totals.amount)}</td>
      <td>{format(totals.sku)}</td>
      <td>{totals.stores}</td>
    </>
  );

  return (
    <div className={tableStyles.container}>
      <div className={tableStyles.header}>Ієрархія LASKA</div>
      <table className={tableStyles.table}>
        <thead><tr><th>Група / Підгрупа / ТМ</th><th>Кількість, шт</th><th>Вага</th><th>Сума, грн</th><th>SKU</th><th>ТТ</th></tr></thead>
        <tbody>
          {Array.from(groups, ([group, subgroups]) => {
            const groupRows = Array.from(subgroups.values()).flat();
            const groupOpen = openGroups.has(group);
            return (
              <Fragment key={group}>
                <tr className={styles.groupRow} onClick={() => toggle(openGroups, group, setOpenGroups)}><td><b>{groupOpen ? '−' : '+'} {group}</b></td>{cells(sumRows(groupRows))}</tr>
                {groupOpen ? Array.from(subgroups, ([subgroup, productRows]) => {
                  const subgroupKey = `${group}::${subgroup}`;
                  const subgroupOpen = openSubgroups.has(subgroupKey);
                  return (
                    <Fragment key={subgroupKey}>
                      <tr className={styles.subgroupRow} onClick={() => toggle(openSubgroups, subgroupKey, setOpenSubgroups)}><td><span className={styles.indent}>↳</span><b>{subgroupOpen ? '−' : '+'} {subgroup}</b></td>{cells(sumRows(productRows))}</tr>
                      {subgroupOpen ? productRows.map(row => <tr key={`${subgroupKey}::${row.tm}`}><td><span className={styles.deepIndent}>↳</span>{row.tm}</td>{cells(row)}</tr>) : null}
                    </Fragment>
                  );
                }) : null}
              </Fragment>
            );
          })}
          <tr className={tableStyles.totalRow}><td><b>Разом</b></td>{cells(sumRows(rows))}</tr>
        </tbody>
      </table>
    </div>
  );
}
