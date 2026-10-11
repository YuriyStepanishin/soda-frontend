import type { Dispatch, SetStateAction } from 'react';
import type { SalesFiltersState } from '../../hooks/useSalesFilters';

import styles from './SalesFilters.module.css';
import MultiSelectDropdown from '../MultiSelectDropdown/MultiSelectDropdown';
import { openDatePicker } from '../../utils/openDatePicker';

type OptionsState = {
  showGroups: boolean;
  showSubgroups: boolean;
  showBrands: boolean;
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
  groups: string[];
  subgroups: string[];
  isLaska: boolean;
  filters: SalesFiltersState;
  updateFilters: (values: Partial<SalesFiltersState>) => void;

  options: OptionsState;
  metrics: MetricsState;

  onChangeOptions: Dispatch<SetStateAction<OptionsState>>;
  onChangeMetrics: Dispatch<SetStateAction<MetricsState>>;

  onSaveExcel?: () => void;
  onApplyFilters?: () => void;
  onOpenSalesByDays: () => void;

  isMobile?: boolean;
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
  groups,
  subgroups,
  isLaska,

  filters,
  updateFilters,

  options,
  metrics,

  onChangeOptions,
  onChangeMetrics,

  onApplyFilters,

  dateError,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.filtersSticky}>
        <section className={styles.filtersHeaderCard}>
          <div className={styles.filtersHeaderMain}>
            <div className={styles.filtersHeaderIcon}>S</div>
            <div>
              <h2 className={styles.filtersHeaderTitle}>Фільтри аналітики</h2>
              <p className={styles.filtersHeaderText}>
                Оберіть період, параметри та показники для формування звіту
              </p>
            </div>
          </div>

          <button
            type="button"
            className={styles.clearButton}
            onClick={() =>
              updateFilters({
                dateFrom: '',
                dateTo: '',
                department: [],
                agent: [],
                stores: [],
                groups: [],
                subgroups: [],
                brands: [],
                products: [],
              })
            }
          >
            Очистити все
          </button>
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Період</h3>
              <p>Оберіть діапазон дат</p>
            </div>
          </div>

          <div className={styles.periodGrid}>
            <div className={styles.fieldBlock}>
              <label>З дати</label>
              <input
                type="date"
                value={filters.dateFrom}
                onClick={e => openDatePicker(e.currentTarget)}
                onChange={e => updateFilters({ dateFrom: e.target.value })}
              />
            </div>

            <div className={styles.fieldBlock}>
              <label>По дату</label>
              <input
                type="date"
                value={filters.dateTo}
                onClick={e => openDatePicker(e.currentTarget)}
                onChange={e => updateFilters({ dateTo: e.target.value })}
              />
            </div>
          </div>

          {dateError && <div className={styles.dateError}>{dateError}</div>}
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Фільтри довідників</h3>
              <p>Оберіть необхідні розрізи для фільтрації даних</p>
            </div>
          </div>

          <div className={styles.filtersGrid}>
            {showDepartment && (
              <MultiSelectDropdown
                label="Відділ"
                items={departments}
                selected={filters.department}
                onChange={value => updateFilters({ department: value })}
                searchable
              />
            )}

            {showAgent ? (
              <MultiSelectDropdown
                label="Торговий представник"
                items={agents}
                selected={filters.agent}
                onChange={value => updateFilters({ agent: value })}
                searchable
              />
            ) : (
              <div className={styles.fieldBlock}>
                <label>Торговий представник</label>
                <div className={styles.lockedValue}>{representativeLabel}</div>
              </div>
            )}

            <MultiSelectDropdown
              label="Торгові точки"
              items={stores}
              selected={filters.stores}
              onChange={value => updateFilters({ stores: value })}
              searchable
            />

            {isLaska && (
              <MultiSelectDropdown
                label="Група"
                items={groups}
                selected={filters.groups}
                onChange={value => updateFilters({ groups: value })}
                searchable
              />
            )}

            {isLaska && (
              <MultiSelectDropdown
                label="Підгрупа"
                items={subgroups}
                selected={filters.subgroups}
                onChange={value => updateFilters({ subgroups: value })}
                searchable
              />
            )}

            <MultiSelectDropdown
              label="ТМ"
              items={brands}
              selected={filters.brands}
              onChange={value => updateFilters({ brands: value })}
              searchable
            />

            <MultiSelectDropdown
              label="Товар"
              items={products}
              selected={filters.products}
              onChange={value => updateFilters({ products: value })}
              searchable
            />
          </div>
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Параметри</h3>
              <p>Оберіть спосіб групування та відображення</p>
            </div>
          </div>

          <div className={styles.optionGrid}>
            {isLaska && (
              <label
                className={
                  options.showGroups
                    ? styles.optionCardActive
                    : styles.optionCard
                }
              >
                <input
                  type="checkbox"
                  checked={options.showGroups}
                  onChange={() =>
                    onChangeOptions(prev => ({
                      ...prev,
                      showGroups: !prev.showGroups,
                    }))
                  }
                />
                <span>Група</span>
              </label>
            )}

            {isLaska && (
              <label
                className={
                  options.showSubgroups
                    ? styles.optionCardActive
                    : styles.optionCard
                }
              >
                <input
                  type="checkbox"
                  checked={options.showSubgroups}
                  onChange={() =>
                    onChangeOptions(prev => ({
                      ...prev,
                      showSubgroups: !prev.showSubgroups,
                    }))
                  }
                />
                <span>Підгрупа</span>
              </label>
            )}

            <label
              className={
                options.showBrands ? styles.optionCardActive : styles.optionCard
              }
            >
              <input
                type="checkbox"
                checked={options.showBrands}
                onChange={() =>
                  onChangeOptions(prev => ({
                    ...prev,
                    showBrands: !prev.showBrands,
                  }))
                }
              />
              <span>ТМ</span>
            </label>

            <label
              className={
                options.showProducts
                  ? styles.optionCardActive
                  : styles.optionCard
              }
            >
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
              <span>Товар</span>
            </label>

            <label
              className={
                options.showDates ? styles.optionCardActive : styles.optionCard
              }
            >
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
              <span>Дата</span>
            </label>

            <label
              className={
                options.showByStore
                  ? styles.optionCardActive
                  : styles.optionCard
              }
            >
              <input
                type="checkbox"
                checked={Boolean(options.showByStore)}
                onChange={() =>
                  onChangeOptions(prev => ({
                    ...prev,
                    showByStore: !prev.showByStore,
                  }))
                }
              />
              <span>Торгові точки</span>
            </label>

            <label
              className={
                options.showByDepartment
                  ? styles.optionCardActive
                  : styles.optionCard
              }
            >
              <input
                type="checkbox"
                checked={Boolean(options.showByDepartment)}
                onChange={() =>
                  onChangeOptions(prev => ({
                    ...prev,
                    showByDepartment: !prev.showByDepartment,
                  }))
                }
              />
              <span>Відділ</span>
            </label>

            <label
              className={
                options.showByAgent
                  ? styles.optionCardActive
                  : styles.optionCard
              }
            >
              <input
                type="checkbox"
                checked={Boolean(options.showByAgent)}
                onChange={() =>
                  onChangeOptions(prev => ({
                    ...prev,
                    showByAgent: !prev.showByAgent,
                  }))
                }
              />
              <span>Торговий представник</span>
            </label>
          </div>
        </section>

        <section className={styles.cardSection}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Показники</h3>
              <p>Оберіть показники для відображення в звіті</p>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <label className={styles.metricCard}>
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
              <span>Кількість, шт</span>
            </label>

            <label className={styles.metricCard}>
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
              <span>Торгові точки</span>
            </label>

            <label className={styles.metricCard}>
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
              <span>Вага, кг</span>
            </label>

            <label className={styles.metricCard}>
              <input
                type="checkbox"
                checked={metrics.amount}
                onChange={() => {
                  onChangeMetrics(prev => ({
                    ...prev,
                    amount: !prev.amount,
                  }));
                }}
              />
              <span>Сума, грн</span>
            </label>

            <label className={styles.metricCard}>
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
              <span>SKU</span>
            </label>
          </div>
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
        </div>
      </div>
    </aside>
  );
}
