import { forwardRef } from 'react';
import type { SummaryResponse } from '../../types/sales';
import styles from './SalesTable.module.css';

type ActiveColumn = {
  key: 'stores' | 'weight' | 'amount';
  label: string;
};

type Props = {
  summaryData?: SummaryResponse;
  activeColumns: ActiveColumn[];
  format: (value: number) => string;
};

const SalesTable = forwardRef<HTMLDivElement, Props>(
  ({ summaryData, activeColumns, format }, ref) => {
    return (
      <div ref={ref} className={styles.mainContent}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Торгова марка</th>

              {activeColumns.map(column => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(summaryData?.data ?? []).map(item => (
              <tr key={item.tm}>
                <td className={styles.brandName}>{item.tm}</td>

                {activeColumns.map(column => (
                  <td key={`${item.tm}-${column.key}`}>
                    {column.key === 'stores'
                      ? item.stores
                      : format(item[column.key])}
                  </td>
                ))}
              </tr>
            ))}

            <tr className={styles.totalRow}>
              <td>
                <b>Усі торгові марки</b>
              </td>

              {activeColumns.map(column => (
                <td key={`total-${column.key}`}>
                  <b>
                    {column.key === 'stores'
                      ? (summaryData?.totals?.stores ?? 0)
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
