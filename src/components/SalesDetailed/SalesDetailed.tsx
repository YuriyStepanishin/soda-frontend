import styles from './SalesDetailed.module.css';

type MetricKey = 'quantity' | 'stores' | 'weight' | 'amount' | 'sku';

type MetricState = Record<MetricKey, boolean>;

type DetailedRow = {
  id: string;
  label: string;
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
};

export default function SalesDetailed({
  rows,
  totals,
  metrics,
  format,
  title,
}: Props) {
  const activeColumns = [
    { key: 'stores', label: 'ТТ' },
    { key: 'quantity', label: 'Кількість, шт' },
    { key: 'weight', label: 'Вага' },
    { key: 'sku', label: 'SKU' },
    { key: 'amount', label: 'Сума, грн' },
  ].filter(column => metrics[column.key as MetricKey]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>{title}</div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Назва</th>
            {activeColumns.map(column => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(item => (
            <tr key={item.id}>
              <td className={styles.label}>{item.label}</td>

              {activeColumns.map(column => (
                <td key={`${item.id}-${column.key}`}>
                  {column.key === 'quantity'
                    ? format(item.quantity)
                    : column.key === 'stores'
                      ? item.stores
                      : column.key === 'sku'
                        ? format(item.sku)
                        : format(item[column.key as MetricKey] ?? 0)}
                </td>
              ))}
            </tr>
          ))}

          <tr className={styles.totalRow}>
            <td>
              <b>Разом</b>
            </td>

            {activeColumns.map(column => (
              <td key={`total-${column.key}`}>
                <b>
                  {column.key === 'quantity'
                    ? format(totals.quantity)
                    : column.key === 'stores'
                      ? totals.stores
                      : column.key === 'sku'
                        ? format(totals.sku)
                        : format(totals[column.key as MetricKey] ?? 0)}
                </b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
