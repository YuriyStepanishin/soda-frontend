import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ApiError } from '../../api/client';
import {
  fetchRouteHistory,
  type RouteHistoryResponse,
} from '../../api/fetchRouteHistory';

import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import SearchInput from '../SearchInput';

import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';

import styles from './RouteHistoryPage.module.css';

type Props = {
  onBack: () => void;
  database: string;
};

type GroupingField = 'group' | 'subgroup' | 'tm' | 'packing';

const GROUPING_OPTIONS: Array<{
  key: GroupingField;
  label: string;
}> = [
  { key: 'group', label: 'Група' },
  { key: 'subgroup', label: 'Підгрупа' },
  { key: 'tm', label: 'ТМ' },
  { key: 'packing', label: 'Фасовка' },
];

const DEFAULT_GROUPING_FIELDS: GroupingField[] = ['group'];
const OLGATORG_GROUPING_FIELDS: GroupingField[] = ['tm'];

function getKyivDateKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatKyivDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const dayLabel = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    weekday: 'long',
  }).format(date);

  return `${dateLabel} (${dayLabel})`;
}

export default function RouteHistoryPage({ onBack, database }: Props) {
  /*
   * ------------------------------------------------------------
   * USER / ROLE
   * ------------------------------------------------------------
   */

  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const ownRepresentative = getUserRepresentative(authEmail);

  const isSupervisor = userRole === 'supervisor';
  const isAgent = userRole === 'agent';

  /*
   * ------------------------------------------------------------
   * UI STATE
   * ------------------------------------------------------------
   */

  const [department, setDepartment] = useState('');
  const [agent, setAgent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const [periodModeState, setPeriodModeState] = useState<{
    database: string;
    value: 'weeks' | 'months';
  }>({ database, value: 'weeks' });

  const [groupingFields, setGroupingFields] = useState<GroupingField[]>(
    DEFAULT_GROUPING_FIELDS
  );

  const periodMode =
    periodModeState.database === database ? periodModeState.value : 'weeks';

  const setPeriodMode = (value: 'weeks' | 'months') => {
    setPeriodModeState({ database, value });
  };

  /*
   * ------------------------------------------------------------
   * SEARCH DEBOUNCE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  /*
   * ------------------------------------------------------------
   * ACTIVE FILTERS
   * ------------------------------------------------------------
   *
   * Для agent backend отримує його власного представника.
   */

  const activeAgent = isAgent ? ownRepresentative || '' : agent;
  const isOlgatorg = database === 'olgatorg';

  const activeGroupingFields = isOlgatorg
    ? OLGATORG_GROUPING_FIELDS
    : groupingFields.length > 0
      ? groupingFields
      : DEFAULT_GROUPING_FIELDS;
  const asOfDate = useMemo(() => getKyivDateKey(), []);
  const asOfDateLabel = useMemo(
    () => formatKyivDateLabel(asOfDate),
    [asOfDate]
  );

  /*
   * ------------------------------------------------------------
   * API QUERY
   * ------------------------------------------------------------
   *
   * Весь розрахунок історії тепер робить backend.
   */

  const historyQuery = useMemo(
    () => ({
      period:
        periodMode === 'months' ? ('4months' as const) : ('4weeks' as const),

      asOfDate,

      ta: activeAgent || undefined,

      storeSearch: debouncedSearchTerm || undefined,

      department: department || undefined,

      groupingFields: activeGroupingFields.join(','),
    }),
    [
      periodMode,
      asOfDate,
      activeAgent,
      debouncedSearchTerm,
      department,
      activeGroupingFields,
    ]
  );

  /*
   * ------------------------------------------------------------
   * LOAD HISTORY
   * ------------------------------------------------------------
   */

  const { data, isLoading, error, refetch } = useQuery<RouteHistoryResponse>({
    queryKey: [...queryKeys.sales, 'route-history', database, historyQuery],

    queryFn: ({ signal }) => fetchRouteHistory(historyQuery, signal),

    staleTime: 60 * 1000,
  });

  /*
   * ------------------------------------------------------------
   * DATA FROM BACKEND
   * ------------------------------------------------------------
   */

  const periods = data?.periods ?? [];
  const stores = data?.stores ?? [];

  const summary = data?.summary ?? {
    allStores: 0,
    withoutHistory: 0,
  };

  /*
   * ------------------------------------------------------------
   * GROUPING
   * ------------------------------------------------------------
   */

  const toggleGroupingField = (field: GroupingField) => {
    setGroupingFields(prev => {
      if (prev.includes(field)) {
        if (prev.length === 1) {
          return prev;
        }

        return prev.filter(item => item !== field);
      }

      return [...prev, field];
    });

    setExpandedStore(null);
  };

  /*
   * ------------------------------------------------------------
   * FORMATTERS
   * ------------------------------------------------------------
   */

  const formatQty = (value: number) =>
    value.toLocaleString('uk-UA', {
      maximumFractionDigits: 2,
    });

  const formatHistoryCell = (value: number) =>
    value === 0 ? '-' : formatQty(value);

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.pageTitle}>Історія продажів по маршруту</h2>

        <p className={styles.pageMeta}>
          Період: <b>{periodMode === 'weeks' ? '4 тижні' : '4 місяці'}</b>
        </p>

        <p className={styles.pageMeta}>{asOfDateLabel}</p>
      </header>

      {isLoading && <Loader />}

      {error && (
        <div className={styles.error} role="alert">
          <p>
            {error instanceof ApiError &&
            error.status === 501 &&
            isOlgatorg
              ? 'Історія продажів для OLGATORG поки не підтримується сервером.'
              : `Не вдалося завантажити історію продажів${
                  error instanceof Error ? `: ${error.message}` : '.'
                }`}
          </p>

          <button type="button" onClick={() => void refetch()}>
            Повторити запит
          </button>
        </div>
      )}

      <section className={styles.filtersCard}>
        <div className={styles.field}>
          <span>Період історії</span>

          <div
            className={styles.periodToggle}
            role="group"
            aria-label="Період історії"
          >
            <button
              type="button"
              className={
                periodMode === 'weeks'
                  ? styles.periodToggleActive
                  : styles.periodToggleButton
              }
              onClick={() => {
                setPeriodMode('weeks');
                setExpandedStore(null);
              }}
            >
              4 тижні
            </button>

            <button
              type="button"
              className={
                periodMode === 'months'
                  ? styles.periodToggleActive
                  : styles.periodToggleButton
              }
              onClick={() => {
                setPeriodMode('months');
                setExpandedStore(null);
              }}
            >
              4 місяці
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <span>Групування</span>

          <div
            className={styles.groupingChecks}
            role="group"
            aria-label="Групування історії"
          >
            {GROUPING_OPTIONS.map(option => (
              <label key={option.key} className={styles.groupingCheckLabel}>
                <input
                  type="checkbox"
                  checked={activeGroupingFields.includes(option.key)}
                  disabled={isOlgatorg && option.key !== 'tm'}
                  onChange={() => toggleGroupingField(option.key)}
                />

                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span>Пошук ТТ</span>

          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Введіть назву ТТ"
            ariaLabel="Пошук торгової точки"
            className={styles.searchInput}
          />
        </label>

        {!isSupervisor && !isAgent && (
          <label className={styles.field}>
            <span>Відділ</span>

            <select
              value={department}
              onChange={event => {
                setDepartment(event.target.value);
                setAgent('');
                setExpandedStore(null);
              }}
            >
              <option value="">Усі відділи</option>

              {(data?.filters?.departments ?? []).map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}

        {isAgent ? (
          <label className={styles.field}>
            <span>Торговий представник</span>

            <div className={styles.lockedValue}>{ownRepresentative || '—'}</div>
          </label>
        ) : (
          <label className={styles.field}>
            <span>Торговий представник</span>

            <select
              value={agent}
              onChange={event => {
                setAgent(event.target.value);
                setExpandedStore(null);
              }}
            >
              <option value="">Усі ТП</option>

              {(data?.filters?.agents ?? []).map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className={styles.summaryCard}>
        <p>
          {searchTerm.trim() ? 'Знайдено ТТ:' : 'ТТ у маршруті:'}{' '}
          <b>{summary.allStores}</b>
        </p>

        <p>
          Без відвантажень за останні{' '}
          {periodMode === 'months' ? '4 місяці' : '4 тижні'}:{' '}
          <b>{summary.withoutHistory}</b>
        </p>
      </section>

      <section className={styles.routeList}>
        {!isLoading && !error && stores.length === 0 && (
          <p className={styles.emptyState}>
            За вибраний період продажів не знайдено.
          </p>
        )}

        {stores.map(store => {
          const isOpen = expandedStore === store.store;

          const nextExpanded = isOpen ? null : store.store;

          return (
            <article
              key={store.store}
              className={`${styles.storeCard} ${
                !store.hasHistory ? styles.storeCardAlert : ''
              }`}
            >
              <button
                type="button"
                className={styles.storeHead}
                onClick={() => setExpandedStore(nextExpanded)}
              >
                <span className={styles.storeName}>{store.store}</span>

                {!store.hasHistory && (
                  <span className={styles.alertChip}>
                    Немає відвантажень за встановлений період
                  </span>
                )}

                <span className={styles.expandIcon}>{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className={styles.historyWrap}>
                  <div className={styles.desktopHistory}>
                    <table className={styles.historyTable}>
                      <thead>
                        <tr>
                          <th>Товар</th>

                          {periods.map(period => (
                            <th key={`${store.store}-${period.key}`}>
                              {period.label}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {store.brands.length === 0 && (
                          <tr>
                            <td
                              colSpan={periods.length + 1}
                              className={styles.emptyCell}
                            >
                              Немає відвантажень за встановлений період.
                            </td>
                          </tr>
                        )}

                        {store.brands.map(brand => (
                          <Fragment key={`${store.store}-${brand.label}`}>
                            {brand.isEmpty ? (
                              <tr className={styles.brandOnlyRowAlert}>
                                <td colSpan={periods.length + 1}>
                                  <b>{brand.label}</b>
                                </td>
                              </tr>
                            ) : (
                              <tr className={styles.brandRow}>
                                <td>
                                  <b>{brand.label}</b>
                                </td>

                                {brand.totals.map((value, index) => (
                                  <td
                                    key={`${store.store}-${brand.label}-total-${index}`}
                                  >
                                    <b>{formatHistoryCell(value)}</b>
                                  </td>
                                ))}
                              </tr>
                            )}

                            {brand.products.map(product => (
                              <tr
                                key={`${store.store}-${brand.label}-${product.name}`}
                              >
                                <td>{product.name}</td>

                                {product.values.map((value, index) => (
                                  <td
                                    key={`${store.store}-${brand.label}-${product.name}-${index}`}
                                  >
                                    {formatHistoryCell(value)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.mobileHistory}>
                    {store.brands.length === 0 && (
                      <p className={styles.emptyCell}>
                        Немає відвантажень за встановлений період.
                      </p>
                    )}

                    {store.brands.map(brand => (
                      <section
                        key={`${store.store}-${brand.label}-mobile`}
                        className={`${styles.mobileBrandBlock} ${
                          brand.isEmpty ? styles.mobileBrandBlockAlert : ''
                        }`}
                      >
                        <div className={styles.mobileBrandHeader}>
                          <h4
                            className={`${styles.mobileBrandTitle} ${
                              brand.isEmpty ? styles.mobileBrandTitleAlert : ''
                            }`}
                          >
                            {brand.label}
                          </h4>

                          {!brand.isEmpty && (
                            <span className={styles.mobileWeekHeader}>
                              {periods.map(period => period.label).join(' | ')}
                            </span>
                          )}
                        </div>

                        {!brand.isEmpty && (
                          <>
                            {brand.products.map(product => (
                              <div
                                key={`${store.store}-${brand.label}-${product.name}-mobile`}
                                className={styles.mobileProductRow}
                              >
                                <p className={styles.mobileProductName}>
                                  {product.name}
                                </p>

                                <p className={styles.mobileWeeksLine}>
                                  {product.values
                                    .map(value => formatHistoryCell(value))
                                    .join(' | ')}
                                </p>
                              </div>
                            ))}
                          </>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <button onClick={onBack} className={styles.backButton}>
        ← Назад
      </button>
    </div>
  );
}
