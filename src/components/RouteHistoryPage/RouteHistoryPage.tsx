import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  const [asOfDate, setAsOfDate] = useState(getKyivDateKey);
  useEffect(() => {
    const updateDate = () => setAsOfDate(getKyivDateKey());
    const timer = window.setInterval(updateDate, 60_000);
    document.addEventListener('visibilitychange', updateDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateDate);
    };
  }, []);
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

      storeSearch: isOlgatorg ? debouncedSearchTerm || undefined : undefined,

      department: department || undefined,

      groupingFields: isOlgatorg ? activeGroupingFields.join(',') : 'group',
      view: isOlgatorg ? undefined : ('stores' as const),
    }),
    [
      periodMode,
      asOfDate,
      activeAgent,
      debouncedSearchTerm,
      department,
      activeGroupingFields,
      isOlgatorg,
    ]
  );

  /*
   * ------------------------------------------------------------
   * LOAD HISTORY
   * ------------------------------------------------------------
   */

  const { data, isLoading, error, refetch } = useQuery<RouteHistoryResponse>({
    queryKey: [
      ...queryKeys.sales,
      'route-history',
      database,
      authEmail,
      historyQuery,
    ],

    queryFn: ({ signal }) => fetchRouteHistory(historyQuery, signal),

    staleTime: 60 * 1000,
    retry: (count, error) =>
      !(error instanceof ApiError && [400, 401, 403].includes(error.status)) &&
      count < 1,
  });

  /*
   * ------------------------------------------------------------
   * DATA FROM BACKEND
   * ------------------------------------------------------------
   */

  const periods = data?.periods ?? [];
  const stores = useMemo(() => {
    const allStores = data?.stores ?? [];
    const search = debouncedSearchTerm.toLocaleLowerCase('uk-UA');
    if (isOlgatorg || !search) return allStores;
    return allStores.filter(
      store =>
        store.store.toLocaleLowerCase('uk-UA').includes(search) ||
        store.code.toLocaleLowerCase('uk-UA').includes(search)
    );
  }, [data?.stores, debouncedSearchTerm, isOlgatorg]);

  const detailQuery = {
    ...historyQuery,
    view: 'details' as const,
    storeCode: expandedStore ?? undefined,
    groupingFields: activeGroupingFields.join(','),
  };
  const detailsEnabled = !isOlgatorg && expandedStore !== null;
  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetails,
  } = useQuery<RouteHistoryResponse>({
    queryKey: [
      ...queryKeys.sales,
      'route-history-detail',
      database,
      authEmail,
      detailQuery,
    ],
    queryFn: ({ signal }) => fetchRouteHistory(detailQuery, signal),
    enabled: detailsEnabled,
    staleTime: 60 * 1000,
    retry: (count, error) =>
      !(error instanceof ApiError && [400, 401, 403].includes(error.status)) &&
      count < 1,
  });

  const summary = !isOlgatorg
    ? {
        allStores: stores.length,
        withoutHistory: stores.filter(store => !store.hasHistory).length,
      }
    : (data?.summary ?? { allStores: 0, withoutHistory: 0 });

  const modalRef = useRef<HTMLDialogElement>(null);
  const modalTrigger = useRef<HTMLButtonElement | null>(null);
  const openedStore = data?.stores.find(store => store.code === expandedStore);
  const openedDetail = !isOlgatorg
    ? detailData?.stores.find(store => store.code === expandedStore)
    : undefined;
  const modalStore =
    openedDetail && openedStore
      ? { ...openedDetail, store: openedStore.store }
      : openedStore;

  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog || expandedStore === null) return;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      if (modalTrigger.current?.isConnected) modalTrigger.current.focus();
    };
  }, [expandedStore]);

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
            {error instanceof ApiError && error.status === 501 && isOlgatorg
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

        {stores.map(store => (
          <article
            key={store.code}
            className={[
              styles.storeCard,
              !store.hasHistory ? styles.storeCardAlert : '',
            ].join(' ')}
          >
            <button
              type="button"
              className={styles.storeHead}
              aria-haspopup="dialog"
              onClick={event => {
                modalTrigger.current = event.currentTarget;
                setExpandedStore(store.code);
              }}
            >
              <span className={styles.storeName}>{store.store}</span>
              {!store.hasHistory && (
                <span className={styles.alertChip}>
                  Немає відвантажень за встановлений період
                </span>
              )}
              <span className={styles.expandIcon} aria-hidden="true">
                ≡
              </span>
            </button>
          </article>
        ))}
      </section>

      <dialog
        ref={modalRef}
        className={styles.historyModal}
        aria-labelledby="route-history-modal-title"
        onCancel={event => {
          event.preventDefault();
          setExpandedStore(null);
        }}
        onClick={event => {
          if (event.target === event.currentTarget) setExpandedStore(null);
        }}
      >
        <header className={styles.modalHeader}>
          <div>
            <p className={styles.modalEyebrow}>Історія продажів</p>
            <h3 id="route-history-modal-title" className={styles.modalTitle}>
              {modalStore?.store ?? 'Торгова точка'}
            </h3>
            <p className={styles.modalPeriod}>
              {periodMode === 'months' ? '4 місяці' : '4 тижні'} ·{' '}
              {asOfDateLabel}
            </p>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            aria-label="Закрити історію торгової точки"
            onClick={() => setExpandedStore(null)}
            autoFocus
          >
            ×
          </button>
        </header>
        <div className={styles.modalControls}>
          <div
            className={styles.periodToggle}
            role="group"
            aria-label="Період історії торгової точки"
          >
            <button
              type="button"
              className={
                periodMode === 'weeks'
                  ? styles.periodToggleActive
                  : styles.periodToggleButton
              }
              aria-pressed={periodMode === 'weeks'}
              onClick={() => setPeriodMode('weeks')}
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
              aria-pressed={periodMode === 'months'}
              onClick={() => setPeriodMode('months')}
            >
              4 місяці
            </button>
          </div>
        </div>
        <div className={styles.modalBody}>
          {!isOlgatorg && detailLoading && <Loader />}
          {!isOlgatorg && detailError && (
            <div className={styles.error} role="alert">
              <p>Не вдалося завантажити історію цієї ТТ.</p>
              <button type="button" onClick={() => void refetchDetails()}>
                Повторити
              </button>
            </div>
          )}
          {modalStore && (isOlgatorg || (!detailLoading && !detailError)) && (
            <div className={styles.historyWrap}>
              <div className={styles.desktopHistory}>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th>Товар</th>

                      {periods.map(period => (
                        <th key={`${modalStore.store}-${period.key}`}>
                          {period.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {modalStore.brands.length === 0 && (
                      <tr>
                        <td
                          colSpan={periods.length + 1}
                          className={styles.emptyCell}
                        >
                          Немає відвантажень за встановлений період.
                        </td>
                      </tr>
                    )}

                    {modalStore.brands.map(brand => (
                      <Fragment key={`${modalStore.store}-${brand.label}`}>
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
                                key={`${modalStore.store}-${brand.label}-total-${index}`}
                              >
                                <b>{formatHistoryCell(value)}</b>
                              </td>
                            ))}
                          </tr>
                        )}

                        {brand.products.map(product => (
                          <tr
                            key={`${modalStore.store}-${brand.label}-${product.name}`}
                          >
                            <td>{product.name}</td>

                            {product.values.map((value, index) => (
                              <td
                                key={`${modalStore.store}-${brand.label}-${product.name}-${index}`}
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
                {modalStore.brands.length === 0 && (
                  <p className={styles.emptyCell}>
                    Немає відвантажень за встановлений період.
                  </p>
                )}

                {modalStore.brands.map(brand => (
                  <section
                    key={`${modalStore.code}-${brand.label}-mobile`}
                    className={[
                      styles.mobileBrandBlock,
                      brand.isEmpty ? styles.mobileBrandBlockAlert : '',
                    ].join(' ')}
                  >
                    <h4
                      className={[
                        styles.mobileBrandTitle,
                        brand.isEmpty ? styles.mobileBrandTitleAlert : '',
                      ].join(' ')}
                    >
                      {brand.label}
                    </h4>

                    {brand.isEmpty ? (
                      <p className={styles.mobileNoSales}>
                        Немає відвантажень за період
                      </p>
                    ) : (
                      <>
                        <div className={styles.mobileTotals}>
                          <p className={styles.mobileTotalsLabel}>
                            Разом по групі
                          </p>

                          <div className={styles.periodGrid}>
                            {periods.map((period, index) => (
                              <div
                                key={period.key}
                                className={styles.periodCell}
                              >
                                <span className={styles.periodLabel}>
                                  {period.label}
                                </span>
                                <strong className={styles.periodValue}>
                                  {formatHistoryCell(brand.totals[index] ?? 0)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        {brand.products.map((product, productIndex) => (
                          <div
                            key={`${product.name}-${productIndex}`}
                            className={styles.mobileProductRow}
                          >
                            <p className={styles.mobileProductName}>
                              {product.name}
                            </p>

                            <div className={styles.periodGrid}>
                              {periods.map((period, index) => (
                                <div
                                  key={period.key}
                                  className={styles.periodCell}
                                >
                                  {/* <span className={styles.periodLabel}>
                                    {period.label}
                                  </span> */}
                                  <strong className={styles.periodValue}>
                                    {formatHistoryCell(
                                      product.values[index] ?? 0
                                    )}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </dialog>

      <button onClick={onBack} className={styles.backButton}>
        ← Назад
      </button>
    </div>
  );
}
