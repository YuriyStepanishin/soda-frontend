import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSales, type Sale } from '../../api/fetchOlgatorgSales';
import { fetchLaskaSales } from '../../api/fetchLaskaSales';
import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import SearchInput from '../SearchInput';
import {
  canUserSeeBrand,
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import styles from './RouteHistoryPage.module.css';

type Props = {
  onBack: () => void;
  database: 'olgatorg' | 'laska';
};

type ProductRow = {
  name: string;
  weeks: number[];
};

type BrandGroup = {
  brand: string;
  products: ProductRow[];
  totals: number[];
  isEmpty: boolean;
};

type StoreHistory = {
  store: string;
  brands: BrandGroup[];
  totals: number[];
  hasHistory: boolean;
};

const REQUIRED_BRANDS = [
  'Greenfield',
  'TESS',
  'Принцеса Нурі',
  'Принцеса Канді',
  'Принцеса Ява',
  'Жокей',
  'JARDIN',
  'PIAZZA',
  'Деліція',
];

function parseDateObject(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (ymdMatch) {
    const [, yearRaw, monthRaw, dayRaw] = ymdMatch;
    const parsed = new Date(
      Number(yearRaw),
      Number(monthRaw) - 1,
      Number(dayRaw)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dmyMatch = trimmed.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\D|$)/
  );
  if (dmyMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dmyMatch;
    const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const parsed = new Date(year, Number(monthRaw) - 1, Number(dayRaw));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function getKyivDateNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === 'year')?.value || '0');
  const month = Number(parts.find(part => part.type === 'month')?.value || '1');
  const day = Number(parts.find(part => part.type === 'day')?.value || '1');

  return new Date(year, month - 1, day);
}

function normalizeWeekendToFriday(date: Date): Date {
  const day = date.getDay();

  if (day === 6) return shiftDays(date, -1);
  if (day === 0) return shiftDays(date, -2);

  return date;
}

function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return { year: utcDate.getUTCFullYear(), week };
}

function getEffectiveDate(item: Sale): Date | null {
  const parsed = parseDateObject(item.дата);
  if (!parsed) return null;

  const shifted = item.сума < 0 ? parsed : shiftDays(parsed, -1);
  return normalizeWeekendToFriday(shifted);
}

function getDateLabel(date: Date): string {
  const weekday = new Intl.DateTimeFormat('uk-UA', { weekday: 'long' }).format(
    date
  );
  const shortDate = new Intl.DateTimeFormat('uk-UA').format(date);

  return `${shortDate} (${weekday})`;
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mapLaskaSaleToHistorySale(
  row: Awaited<ReturnType<typeof fetchLaskaSales>>[number]
): Sale {
  return {
    місяць: row.date,
    дата: row.date,
    бренд: row.tm,
    товар: row.product,
    вага: row.weight,
    кількість: row.quantity,
    сума: row.amount,
    точка: row.store,
    адреса: row.address,
    агент: row.ta,
    відділ: row.department,
    торгова_точка: row.store,
    джерело: 'laska',
  };
}

export default function RouteHistoryPage({ onBack, database }: Props) {
  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const ownRepresentative = getUserRepresentative(authEmail);
  const isSupervisor = userRole === 'supervisor';
  const isAgent = userRole === 'agent';
  const storeNameCollator = useMemo(
    () => new Intl.Collator('uk', { sensitivity: 'base' }),
    []
  );

  const [department, setDepartment] = useState('');
  const [agent, setAgent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<'weeks' | 'months'>('weeks');

  const today = useMemo(() => normalizeWeekendToFriday(getKyivDateNow()), []);
  const historyFrom = useMemo(
    () =>
      periodMode === 'months'
        ? new Date(today.getFullYear(), today.getMonth() - 4, 1)
        : shiftDays(today, -35),
    [periodMode, today]
  );
  const historyQuery = useMemo(
    () => ({
      dateFrom: formatIsoDate(historyFrom),
      dateTo: formatIsoDate(today),
    }),
    [historyFrom, today]
  );

  const salesQuery = useQuery<Sale[]>({
    queryKey: [...queryKeys.sales, 'route-history', database, historyQuery],
    queryFn: async () => {
      if (database === 'laska') {
        const rows = await fetchLaskaSales(historyQuery);
        return rows.map(mapLaskaSaleToHistorySale);
      }

      return fetchSales(historyQuery);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data = [], isLoading, error } = salesQuery;

  const uniqueDepartments = useMemo(
    () => [...new Set(data.map(item => item.відділ).filter(Boolean))].sort(),
    [data]
  );

  const uniqueAgents = useMemo(() => {
    return [
      ...new Set(
        data
          .filter(item => !department || item.відділ === department)
          .map(item => item.агент)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [data, department]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return data.filter(item => {
      if (!canUserSeeBrand(authEmail, item.бренд)) return false;
      if (department && item.відділ !== department) return false;
      if (agent && item.агент !== agent) return false;
      if (!item.торгова_точка) return false;

      if (query) {
        const store = item.торгова_точка.toLowerCase();
        if (!store.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [data, department, agent, searchTerm, authEmail]);

  const periodKeys = useMemo(() => {
    const keys: string[] = [];

    for (let offset = 1; offset <= 4; offset += 1) {
      if (periodMode === 'weeks') {
        const date = shiftDays(today, -offset * 7);
        const info = getIsoWeekInfo(date);
        keys.push(`${info.year}-W${String(info.week).padStart(2, '0')}`);
      } else {
        const date = new Date(
          today.getFullYear(),
          today.getMonth() - offset,
          1
        );
        keys.push(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        );
      }
    }

    return keys;
  }, [periodMode, today]);

  const periodIndexMap = useMemo(() => {
    const indexMap = new Map<string, number>();
    periodKeys.forEach((key, index) => indexMap.set(key, index));
    return indexMap;
  }, [periodKeys]);

  const periodLabels = useMemo(
    () =>
      periodKeys.map(key => {
        if (periodMode === 'months') {
          const [year, month] = key.split('-');
          return `${month}.${year}`;
        }
        return key.split('-W')[1] ?? '-';
      }),
    [periodKeys, periodMode]
  );

  const routeStores = useMemo(() => {
    const stores = new Set(
      filtered
        .map(item => item.торгова_точка)
        .filter((store): store is string => Boolean(store))
    );

    return Array.from(stores).sort((a, b) => storeNameCollator.compare(a, b));
  }, [filtered, storeNameCollator]);

  const visibleBrands = useMemo(() => {
    const normalized = (value: string) =>
      value
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('uk-UA');

    const brandsFromData = [
      ...new Set(
        filtered
          .map(item => item.бренд)
          .filter((brand): brand is string => Boolean(brand))
      ),
    ]
      .filter(brand => canUserSeeBrand(authEmail, brand))
      .sort((a, b) => a.localeCompare(b, 'uk'));

    return [
      ...REQUIRED_BRANDS.filter(brand => canUserSeeBrand(authEmail, brand)),
      ...brandsFromData.filter(
        brand =>
          !REQUIRED_BRANDS.some(
            requiredBrand => normalized(requiredBrand) === normalized(brand)
          )
      ),
    ];
  }, [filtered, authEmail]);

  const storeHistory = useMemo<StoreHistory[]>(() => {
    const storesSet = new Set(routeStores);
    const historyByStore = new Map<
      string,
      Map<string, Map<string, number[]>>
    >();

    filtered.forEach(item => {
      if (!storesSet.has(item.торгова_точка)) return;

      const effectiveDate = getEffectiveDate(item);
      if (!effectiveDate) return;

      const periodKey =
        periodMode === 'months'
          ? `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}`
          : (() => {
              const weekInfo = getIsoWeekInfo(effectiveDate);
              return `${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`;
            })();
      const weekIndex = periodIndexMap.get(periodKey);

      if (weekIndex === undefined) return;

      if (!historyByStore.has(item.торгова_точка)) {
        historyByStore.set(item.торгова_точка, new Map());
      }

      const byBrand = historyByStore.get(item.торгова_точка);
      if (!byBrand) return;

      const brand = item.бренд || 'Без ТМ';
      const product = item.товар || 'Без назви';

      if (!byBrand.has(brand)) byBrand.set(brand, new Map());
      const byProduct = byBrand.get(brand);
      if (!byProduct) return;

      if (!byProduct.has(product)) byProduct.set(product, [0, 0, 0, 0]);
      const bucket = byProduct.get(product);
      if (!bucket) return;

      bucket[weekIndex] += item.кількість || 0;
    });

    return routeStores.map(store => {
      const byBrand: Map<string, Map<string, number[]>> = historyByStore.get(
        store
      ) ?? new Map<string, Map<string, number[]>>();

      const brands: BrandGroup[] = visibleBrands.map(brand => {
        const byProduct = byBrand.get(brand) ?? new Map<string, number[]>();

        const products: ProductRow[] = Array.from(byProduct.entries())
          .map(([name, weeks]: [string, number[]]) => ({
            name,
            weeks,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

        const totals = [0, 0, 0, 0];
        products.forEach(product => {
          product.weeks.forEach((value: number, idx: number) => {
            totals[idx] += value;
          });
        });

        const isEmpty = totals.every(value => value === 0);

        return {
          brand,
          products,
          totals,
          isEmpty,
        };
      });

      const totals = [0, 0, 0, 0];
      brands.forEach(brand => {
        brand.totals.forEach((value, idx) => {
          totals[idx] += value;
        });
      });

      return {
        store,
        brands,
        totals,
        hasHistory: totals.some(value => value !== 0),
      };
    });
  }, [filtered, periodIndexMap, periodMode, routeStores, visibleBrands]);

  const summary = useMemo(() => {
    const withoutHistory = storeHistory.filter(item => !item.hasHistory).length;
    return {
      allStores: storeHistory.length,
      withoutHistory,
    };
  }, [storeHistory]);

  const formatQty = (value: number) =>
    value.toLocaleString('uk-UA', {
      maximumFractionDigits: 2,
    });

  const formatHistoryCell = (value: number) =>
    value === 0 ? '-' : formatQty(value);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.pageTitle}>Історія продажів по маршруту</h2>
        <p className={styles.pageMeta}>
          Поточна дата: <b>{getDateLabel(today)}</b>
        </p>
      </header>

      {isLoading && <Loader />}

      {error && (
        <div className={styles.error} role="alert">
          <p>
            Не вдалося завантажити історію продажів
            {error instanceof Error ? `: ${error.message}` : '.'}
          </p>
          <button type="button" onClick={() => void salesQuery.refetch()}>
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
              {uniqueDepartments.map(item => (
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
              {uniqueAgents.map(item => (
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
          {searchTerm.trim() ? 'Знайдено ТТ:' : 'ТТ у маршруті (з усіх даних):'}{' '}
          <b>{summary.allStores}</b>
        </p>
        <p>
          Без відвантажень за останні 4 тижні: <b>{summary.withoutHistory}</b>
        </p>
      </section>

      <section className={styles.routeList}>
        {!isLoading && !error && storeHistory.length === 0 && (
          <p className={styles.emptyState}>
            За вибраний період продажів не знайдено.
          </p>
        )}
        {storeHistory.map(store => {
          const isOpen = expandedStore === store.store;
          const nextExpanded = isOpen ? null : store.store;

          return (
            <article
              key={store.store}
              className={`${styles.storeCard} ${!store.hasHistory ? styles.storeCardAlert : ''}`}
            >
              <button
                type="button"
                className={styles.storeHead}
                onClick={() => setExpandedStore(nextExpanded)}
              >
                <span className={styles.storeName}>{store.store}</span>
                {!store.hasHistory && (
                  <span className={styles.alertChip}>
                    Немає відвантажень 4 тижні
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
                          {periodLabels.map((periodLabel, index) => (
                            <th key={`${store.store}-week-${index}`}>
                              {periodLabel}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {store.brands.length === 0 && (
                          <tr>
                            <td colSpan={5} className={styles.emptyCell}>
                              За останні 4 тижні немає даних.
                            </td>
                          </tr>
                        )}

                        {store.brands.map(brand => (
                          <Fragment key={`${store.store}-${brand.brand}`}>
                            {brand.isEmpty ? (
                              <tr className={styles.brandOnlyRowAlert}>
                                <td colSpan={5}>
                                  <b>{brand.brand}</b>
                                </td>
                              </tr>
                            ) : (
                              <tr className={styles.brandRow}>
                                <td>
                                  <b>{brand.brand}</b>
                                </td>
                                {brand.totals.map((value, index) => (
                                  <td
                                    key={`${store.store}-${brand.brand}-total-${index}`}
                                  >
                                    <b>{formatHistoryCell(value)}</b>
                                  </td>
                                ))}
                              </tr>
                            )}

                            {brand.products.map(product => (
                              <tr
                                key={`${store.store}-${brand.brand}-${product.name}`}
                              >
                                <td>{product.name}</td>
                                {product.weeks.map((value, index) => (
                                  <td
                                    key={`${store.store}-${brand.brand}-${product.name}-${index}`}
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
                        За останні 4 тижні немає даних.
                      </p>
                    )}

                    {store.brands.map(brand => (
                      <section
                        key={`${store.store}-${brand.brand}-mobile`}
                        className={`${styles.mobileBrandBlock} ${brand.isEmpty ? styles.mobileBrandBlockAlert : ''}`}
                      >
                        <div className={styles.mobileBrandHeader}>
                          <h4
                            className={`${styles.mobileBrandTitle} ${brand.isEmpty ? styles.mobileBrandTitleAlert : ''}`}
                          >
                            {brand.brand}
                          </h4>

                          {!brand.isEmpty && (
                            <span className={styles.mobileWeekHeader}>
                              {periodLabels.join(' | ')}
                            </span>
                          )}
                        </div>

                        {!brand.isEmpty && (
                          <>
                            {brand.products.map(product => (
                              <div
                                key={`${store.store}-${brand.brand}-${product.name}-mobile`}
                                className={styles.mobileProductRow}
                              >
                                <p className={styles.mobileProductName}>
                                  {product.name}
                                </p>
                                <p className={styles.mobileWeeksLine}>
                                  {product.weeks
                                    .map(value => formatHistoryCell(value ?? 0))
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
