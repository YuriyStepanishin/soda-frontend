import SortableSalesParameters from './SortableSalesParameters';
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
  vmd: boolean;
  quantity: boolean;
  weight: boolean;
  amount: boolean;
  sku: boolean;
  stores: boolean;
};

type Props = {
  canViewVmd?: boolean;
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
  hierarchyOrder?: string[];
  onHierarchyOrderChange?: (fields: string[]) => void;
};

export default function SalesFilters({
  canViewVmd = false,
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
  hierarchyOrder = [
    'group',
    'subgroup',
    'brand',
    'product',
    'date',
    'store',
    'department',
    'agent',
  ],
  onHierarchyOrderChange,
}: Props) {
  const parameterOptions: Array<{
    field: string;
    label: string;
    key: keyof OptionsState;
  }> = [
    { field: 'group', label: 'Група', key: 'showGroups' },
    { field: 'subgroup', label: 'Підгрупа', key: 'showSubgroups' },
    { field: 'brand', label: 'ТМ', key: 'showBrands' },
    { field: 'product', label: 'Товар', key: 'showProducts' },
    { field: 'date', label: 'Дата', key: 'showDates' },
    {
      field: 'store',
      label: 'Найменування торгової точки',
      key: 'showByStore',
    },
    { field: 'department', label: 'Відділ', key: 'showByDepartment' },
    { field: 'agent', label: 'Торговий представник', key: 'showByAgent' },
  ];
  const orderedParameters = hierarchyOrder.flatMap(field => {
    const option = parameterOptions.find(item => item.field === field);
    if (!option || (!isLaska && (field === 'group' || field === 'subgroup')))
      return [];
    return [{ field, label: option.label, checked: options[option.key] }];
  });
  return (
    <aside className={styles.sidebar}>
      <div className={styles.filtersSticky}>
        <section className={styles.filtersHeaderCard}>
          <div className={styles.filtersHeaderMain}>
            <div className={styles.filtersHeaderIcon}>S</div>
            <div>
              <h2 className={styles.filtersHeaderTitle}>Аналітика продажів</h2>
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

        <section className={`${styles.cardSection} ${styles.periodSection}`}>
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

        <section className={`${styles.cardSection} ${styles.dictionarySection}`}>
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
                items={groups.filter(item => item.trim().toLocaleUpperCase('uk-UA') !== 'ІНШЕ')}
                selected={filters.groups}
                onChange={value => updateFilters({ groups: value })}
                searchable
              />
            )}

            {isLaska && (
              <MultiSelectDropdown
                label="Підгрупа"
                items={subgroups.filter(item => item.trim().toLocaleUpperCase('uk-UA') !== 'ІНШЕ')}
                selected={filters.subgroups}
                onChange={value => updateFilters({ subgroups: value })}
                searchable
              />
            )}

            <MultiSelectDropdown
              label="ТМ"
              items={brands.filter(item => item.trim().toLocaleUpperCase('uk-UA') !== 'ІНШЕ')}
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

        <section className={`${styles.cardSection} ${styles.parametersSection}`}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Параметри</h3>
              <p>
                Перетягуйте параметри за ⠿, щоб задати порядок ієрархії. У звіт
                потрапляють лише позначені.
              </p>
            </div>
          </div>

          <SortableSalesParameters
            items={orderedParameters}
            onOrderChange={onHierarchyOrderChange}
            onToggle={field => {
              const option = parameterOptions.find(
                item => item.field === field
              );
              if (option)
                onChangeOptions(previous => ({
                  ...previous,
                  [option.key]: !previous[option.key],
                }));
            }}
          />
          {!orderedParameters.some(item => item.checked) ? (
            <p role="status">Оберіть хоча б один параметр для звіту.</p>
          ) : null}
        </section>

        <section className={`${styles.cardSection} ${styles.metricsSection}`}>
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
              <span>АКБ</span>
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
            {canViewVmd && <label className={styles.metricCard}>
              <input type="checkbox" checked={metrics.vmd} onChange={() => onChangeMetrics(prev => ({ ...prev, vmd: !prev.vmd }))} />
              <span>ВМД, грн</span>
            </label>}
          </div>
        </section>

        <div className={styles.sidebarButtons}>
          <div className={styles.desktopHierarchy} aria-label="Вибрана ієрархія звіту">
            <span>Вибрана ієрархія:</span>
            <div>{orderedParameters.filter(item => item.checked).map(item => <span key={item.field}>{item.label}</span>)}</div>
          </div>
          {onApplyFilters ? (
            <button
              type="button"
              className={styles.sidebarSaveButton}
              disabled={!orderedParameters.some(item => item.checked)}
              onClick={onApplyFilters}
            >
              <span className={styles.mobileActionLabel}>Сформувати</span>
              <span className={styles.desktopActionLabel}>Сформувати звіт</span>
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
