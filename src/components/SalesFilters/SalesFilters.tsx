import type { Dispatch, SetStateAction } from 'react';
import type { SalesFiltersState } from '../../hooks/useSalesFilters';

import styles from './SalesFilters.module.css';
import MultiSelectDropdown from '../MultiSelectDropdown/MultiSelectDropdown';

type OptionsState = {
  showDates: boolean;
  showProducts: boolean;
  showPrice: boolean;
  showByStore: boolean;
  showByDepartment: boolean;
  showByAgent: boolean;
};

type MetricsState = {
  quantity: boolean;
  weight: boolean;
  amount: boolean;
  sku: boolean;
  stores: boolean;
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
  onApplyFilters?: () => void;
  onOpenSalesByDays: () => void;

  isMobile: boolean;
  dateError?: string;
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
  onApplyFilters,
  onOpenSalesByDays,

  isMobile,
  dateError,
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

          {dateError && <div className={styles.dateError}>{dateError}</div>}

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
                onChangeOptions(prev => {
                  const nextValue = !prev.showProducts;

                  if (!nextValue) {
                    onChangeMetrics(currentMetrics => ({
                      ...currentMetrics,
                      amount: false,
                    }));
                  }

                  return {
                    ...prev,
                    showProducts: nextValue,
                  };
                })
              }
            />
            З товаром
          </label>

          <label>
            <input
              type="checkbox"
              checked={Boolean(options.showByStore)}
              onChange={() =>
                onChangeOptions(prev => ({
                  ...prev,
                  showByStore: !prev.showByStore,
                  showByDepartment: false,
                  showByAgent: false,
                }))
              }
            />
            По ТТ
          </label>

          <label>
            <input
              type="checkbox"
              checked={Boolean(options.showByDepartment)}
              onChange={() =>
                onChangeOptions(prev => ({
                  ...prev,
                  showByStore: false,
                  showByDepartment: !prev.showByDepartment,
                  showByAgent: false,
                }))
              }
            />
            По відділам
          </label>

          <label>
            <input
              type="checkbox"
              checked={Boolean(options.showByAgent)}
              onChange={() =>
                onChangeOptions(prev => ({
                  ...prev,
                  showByStore: false,
                  showByDepartment: false,
                  showByAgent: !prev.showByAgent,
                }))
              }
            />
            По ТП
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
              checked={metrics.stores}
              onChange={() =>
                onChangeMetrics(prev => ({
                  ...prev,
                  stores: !prev.stores,
                }))
              }
            />
            ТТ
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
              checked={Boolean(options.showProducts && metrics.amount)}
              disabled={!options.showProducts}
              onChange={() => {
                if (!options.showProducts) return;

                onChangeMetrics(prev => ({
                  ...prev,
                  amount: !prev.amount,
                }));
              }}
            />
            Ціна, грн
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
        </section>

        <div className={styles.sidebarButtons}>
          {onApplyFilters ? (
            <button
              type="button"
              className={styles.sidebarSaveButton}
              onClick={onApplyFilters}
            >
              Сформувати
            </button>
          ) : null}
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
