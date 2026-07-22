import type { Dispatch, SetStateAction } from 'react';
import type { SalesFiltersState } from '../../hooks/useSalesFilters';

import styles from './SalesFilters.module.css';
import MultiSelectDropdown from '../MultiSelectDropdown/MultiSelectDropdown';

type OptionsState = {
  showDates: boolean;
  showProducts: boolean;
};

type MetricsState = {
  quantity: boolean;
  weight: boolean;
  amount: boolean;
  sku: boolean;
  price: boolean;
};

type Props = {
  departments: string[];
  agents: string[];

  showDepartment: boolean;
  showAgent: boolean;

  representativeLabel?: string;

  stores: string[];
  products: string[];
  brands: string[];
  filters: SalesFiltersState;
  updateFilters: (values: Partial<SalesFiltersState>) => void;

  options: OptionsState;
  metrics: MetricsState;

  onChangeOptions: Dispatch<SetStateAction<OptionsState>>;
  onChangeMetrics: Dispatch<SetStateAction<MetricsState>>;

  onSaveExcel: () => void;
  onOpenSalesByDays: () => void;

  isMobile: boolean;
};

export default function SalesFilters({
  departments,
  agents,

  showDepartment,
  showAgent,

  representativeLabel,

  stores,
  products,
  brands,

  filters,
  updateFilters,

  options,
  metrics,

  onChangeOptions,
  onChangeMetrics,

  onSaveExcel,
  onOpenSalesByDays,

  isMobile,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.filtersSticky}>
        <section className={styles.sidebarSection}>
          <h3>Період</h3>

          <div className={styles.sidebarControls}>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => updateFilters({ dateFrom: e.target.value })}
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={e => updateFilters({ dateTo: e.target.value })}
            />
          </div>

          {showDepartment && (
            <MultiSelectDropdown
              label="Відділ"
              items={departments}
              selected={filters.department}
              onChange={value => updateFilters({ department: value })}
            />
          )}

          {showAgent ? (
            <MultiSelectDropdown
              label="ТП"
              items={agents}
              selected={filters.agent}
              onChange={value => updateFilters({ agent: value })}
            />
          ) : (
            <div className={styles.lockedValue}>{representativeLabel}</div>
          )}

          <MultiSelectDropdown
            label="ТТ"
            items={stores}
            selected={filters.stores}
            onChange={value => updateFilters({ stores: value })}
            searchable
          />

          <MultiSelectDropdown
            label="ТМ"
            items={brands}
            selected={filters.brands}
            onChange={value => updateFilters({ brands: value })}
          />

          <MultiSelectDropdown
            label="Товар"
            items={products}
            selected={filters.products}
            onChange={value => updateFilters({ products: value })}
            searchable
          />
        </section>

        <section className={styles.sidebarSection}>
          <h3>Параметри</h3>

          <label>
            <input
              type="checkbox"
              checked={options.showDates}
              onChange={() =>
                onChangeOptions(prev => ({
                  ...prev,
                  showDates: !prev.showDates,
                }))
              }
            />
            По датах
          </label>

          <label>
            <input
              type="checkbox"
              checked={options.showProducts}
              onChange={() =>
                onChangeOptions(prev => ({
                  ...prev,
                  showProducts: !prev.showProducts,
                }))
              }
            />
            З товаром
          </label>

          <h3>Показники</h3>
          <label>
            <input
              type="checkbox"
              checked={metrics.quantity}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  quantity: !prev.quantity,
                }))
              }
            />
            Кількість, шт
          </label>

          <label>
            <input
              type="checkbox"
              checked={metrics.weight}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  weight: !prev.weight,
                }))
              }
            />
            Вага, кг
          </label>

          <label>
            <input
              type="checkbox"
              checked={metrics.amount}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  amount: !prev.amount,
                }))
              }
            />
            Сума, грн
          </label>

          <label>
            <input
              type="checkbox"
              checked={metrics.sku}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  sku: !prev.sku,
                }))
              }
            />
            SKU
          </label>

          <label>
            <input
              type="checkbox"
              checked={metrics.price}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  price: !prev.price,
                }))
              }
            />
            Ціна, грн
          </label>
        </section>

        <div className={styles.sidebarButtons}>
          <button
            type="button"
            className={styles.sidebarSaveButton}
            onClick={onSaveExcel}
          >
            {isMobile ? 'Поділитись' : 'Зберегти'}
          </button>

          <button
            type="button"
            className={styles.salesByDaysButton}
            onClick={onOpenSalesByDays}
          >
            Продажі по днях
          </button>
        </div>
      </div>
    </aside>
  );
}
