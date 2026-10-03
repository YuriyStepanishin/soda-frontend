import { forwardRef } from 'react';
import type { SummaryResponse } from '../../types/sales';
import styles from './SalesTable.module.css';

type ActiveColumn = {
  key: 'quantity' | 'stores' | 'weight' | 'amount' | 'sku';
  label: string;
};

type Props = {
  summaryData?: SummaryResponse;
  activeColumns: ActiveColumn[];
  format: (value: number) => string;
  showGroup?: boolean;
};

const SalesTable = forwardRef<HTMLDivElement, Props>(
    ({ summaryData, activeColumns, format, showGroup = false }, ref) => {
    return (
      <div ref={ref} className={styles.mainContent}>
        <table className={styles.table}>
          <thead>
            <tr>
              {showGroup ? <th>Група</th> : null}
              <th>Торгова марка</th>

              {activeColumns.map(column => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(summaryData?.data ?? []).map(item => (
              <tr key={`${item.group ?? ''}-${item.tm}`}>
                {showGroup ? <td>{item.group ?? 'Без групи'}</td> : null}
                <td className={styles.brandName}>{item.tm}</td>

                {activeColumns.map(column => (
                  <td key={`${item.tm}-${column.key}`}>
                    {column.key === 'quantity'
                      ? format(item.quantity ?? 0)
                      : column.key === 'stores'
                        ? item.stores
                        : column.key === 'sku'
                          ? format(item.sku ?? 0)
                          : format(item[column.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}

            <tr className={styles.totalRow}>
              {showGroup ? <td><b>Усі групи</b></td> : null}
              <td>
                <b>Усі торгові марки</b>
              </td>

              {activeColumns.map(column => (
                <td key={`total-${column.key}`}>
                  <b>
                    {column.key === 'quantity'
                      ? format(summaryData?.totals?.quantity ?? 0)
                      : column.key === 'stores'
                        ? (summaryData?.totals?.stores ?? 0)
                        : column.key === 'sku'
                          ? format(summaryData?.totals?.sku ?? 0)
                          : format(summaryData?.totals?.[column.key] ?? 0)}
                  </b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
);

SalesTable.displayName = 'SalesTable';

export default SalesTable;
