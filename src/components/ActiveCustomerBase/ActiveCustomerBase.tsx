import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSales, type Sale } from '../../api/fetchOlgatorgSales';
import { fetchRoutes, type RouteRow } from '../../api/fetchOlgatorgRoutes';
import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import SearchInput from '../SearchInput';
import {
  canUserSeeBrand,
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import {
  loadPlanColumns,
  canViewPlanColumnByEmail,
  calcColumnFact,
  filterSalesByPlanColumn,
  metricLabel,
  type PlanColumn,
} from '../ImplementationPage/planColumnsStorage';
import styles from './ActiveCustomerBase.module.css';

type Props = {
  onBack: () => void;
};

type StoreAggregate = {
  store: string;
  sum: number;
  deliciaSum: number;
};

type GoalCard = {
  id: string;
  label: string;
  metric: PlanColumn['metric'];
  threshold: number;
  plan: number;
  fact: number;
  colorClass: string;
  unitLabel: string;
  factDetails: string[];
};

type StoreGoalsCard = {
  store: string;
  goals: GoalCard[];
};

const DELICIA = 'Деліція';

function normalizeBrand(brand: string): string {
  return brand
    .replace(/[\u2019\u02BC'`]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

const DELICIA_NORMALIZED = normalizeBrand(DELICIA);

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

function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
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

function getIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getRouteDayLabel(date: Date): string {
  const weekday = getIsoWeekday(date);
  if (weekday === 1) return 'понеділок';
  if (weekday === 2) return 'вівторок';
  if (weekday === 3) return 'середа';
  if (weekday === 4) return 'четвер';
  return 'пʼятниця';
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

function normalizeText(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function isThresholdMetric(metric: PlanColumn['metric']): boolean {
  return (
    metric === 'tt_from_x' ||
    metric === 'tt_from_kg' ||
    metric === 'tt_from_pcs' ||
    metric === 'tt_from_sku'
  );
}

function getGoalColorClass(
  metric: PlanColumn['metric'],
  threshold: number,
  fact: number,
  ttFact: number
): string {
  if (metric === 'grn' || metric === 'kg' || metric === 'pcs') {
    return fact > 0 ? styles.valueGreen : styles.valueRed;
  }

  if (metric === 'tt') {
    return ttFact > 0 ? styles.valueGreen : styles.valueRed;
  }

  if (isThresholdMetric(metric)) {
    if (ttFact > 0) return styles.valueGreen;
    if (threshold > 0 && fact > 0) return styles.valueYellow;
    return styles.valueRed;
  }

  return fact > 0 ? styles.valueGreen : styles.valueRed;
}

function getMetricUnitLabel(metric: PlanColumn['metric']): string {
  if (metric === 'grn') return 'грн';
  if (metric === 'kg') return 'кг';
  if (metric === 'pcs') return 'шт';

  if (metric === 'tt') return 'шт';
  if (metric === 'tt_from_x') return 'грн';
  if (metric === 'tt_from_kg') return 'кг';
  if (metric === 'tt_from_pcs') return 'шт';
  if (metric === 'tt_from_sku') return 'SKU';

  return 'SKU';
}

function getDisplayFactValue(sales: Sale[], column: PlanColumn): number {
  if (column.metric === 'avg_sku') {
    return calcColumnFact(sales, column);
  }

  const filteredSales = filterSalesByPlanColumn(sales, column);

  if (column.metric === 'grn' || column.metric === 'tt_from_x') {
    return filteredSales.reduce((sum, sale) => sum + (sale.сума || 0), 0);
  }

  if (column.metric === 'kg' || column.metric === 'tt_from_kg') {
    return filteredSales.reduce((sum, sale) => sum + (sale.вага || 0), 0);
  }

  if (
    column.metric === 'pcs' ||
    column.metric === 'tt' ||
    column.metric === 'tt_from_pcs'
  ) {
    return filteredSales.reduce((sum, sale) => sum + (sale.кількість || 0), 0);
  }

  if (
    column.metric === 'tt_from_sku' ||
    column.metric === 'checkin_sku' ||
    column.metric === 'total_sku'
  ) {
    const skuSet = new Set(
      filteredSales
        .map(sale => sale.товар?.trim().toLocaleLowerCase('uk-UA'))
        .filter(Boolean)
    );
    return skuSet.size;
  }

  return calcColumnFact(sales, column);
}

function formatMetricValue(value: number, unitLabel: string): string {
  return `${value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ${unitLabel}`;
}

function isSkuMetric(metric: PlanColumn['metric']): boolean {
  return (
    metric === 'checkin_sku' || metric === 'total_sku' || metric === 'avg_sku'
  );
}

function getSkuFactDetails(sales: Sale[], column: PlanColumn): string[] {
  const filteredSales = filterSalesByPlanColumn(sales, column);
  const uniqueProducts = new Map<string, string>();

  for (const sale of filteredSales) {
    const product = sale.товар.trim();
    if (!product) continue;

    const key = normalizeText(product);
    if (!uniqueProducts.has(key)) {
      uniqueProducts.set(key, product);
    }
  }

  return [...uniqueProducts.values()].sort((left, right) =>
    left.localeCompare(right, 'uk-UA')
  );
}

function findDepartmentMode(
  column: PlanColumn,
  department: string
): 'total' | 'individual' | null {
  const target = normalizeText(department);
  const entries = Object.entries(column.deptMode ?? {});

  for (const [key, mode] of entries) {
    if (normalizeText(key) === target) {
      return mode;
    }
  }

  return null;
}

function findDepartmentPlan(column: PlanColumn, department: string): number {
  const target = normalizeText(department);
  const entries = Object.entries(column.deptPlans ?? {});

  for (const [key, value] of entries) {
    if (normalizeText(key) === target) {
      return value || 0;
    }
  }

  return 0;
}

export default function ActiveCustomerBase({ onBack }: Props) {
  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const ownRepresentative = getUserRepresentative(authEmail);
  const canSeeDelicia = canUserSeeBrand(authEmail, DELICIA);
  const isSupervisor = userRole === 'supervisor';
  const isAgent = userRole === 'agent';
  const storeNameCollator = useMemo(
    () => new Intl.Collator('uk', { sensitivity: 'base' }),
    []
  );

  const [expandedStores, setExpandedStores] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [agent, setAgent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleStoreGoals = useCallback((store: string) => {
    setExpandedStores(prev =>
      prev.includes(store)
        ? prev.filter(item => item !== store)
        : [...prev, store]
    );
  }, []);

  const {
    data = [],
    isLoading,
    error,
  } = useQuery<Sale[]>({
    queryKey: queryKeys.sales,
    queryFn: fetchSales,
    staleTime: 1000 * 60 * 5,
  });

  const { data: routes = [], isLoading: isRoutesLoading } = useQuery<
    RouteRow[]
  >({
    queryKey: queryKeys.routes,
    queryFn: fetchRoutes,
    staleTime: 1000 * 60 * 5,
  });

  const { data: planColumns = [], isLoading: isPlanLoading } = useQuery<
    PlanColumn[]
  >({
    queryKey: queryKeys.planTargets,
    queryFn: loadPlanColumns,
    staleTime: 1000 * 60 * 5,
  });

  const now = useMemo(() => getKyivDateNow(), []);
  const today = useMemo(() => normalizeWeekendToFriday(now), [now]);
  const currentRouteDay = useMemo(() => getRouteDayLabel(today), [today]);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const normalizedSales = useMemo(() => {
    return data
      .map(item => {
        const effectiveDate = getEffectiveDate(item);
        if (!item.торгова_точка || !effectiveDate) return null;

        return {
          ...item,
          effectiveDate,
        };
      })
      .filter(
        (
          item
        ): item is Sale & {
          effectiveDate: Date;
        } => item !== null
      );
  }, [data]);

  const uniqueDepartments = useMemo(
    () =>
      [
        ...new Set(normalizedSales.map(item => item.відділ).filter(Boolean)),
      ].sort(),
    [normalizedSales]
  );

  const uniqueAgents = useMemo(() => {
    return [
      ...new Set(
        normalizedSales
          .filter(item => !department || item.відділ === department)
          .map(item => item.агент)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [normalizedSales, department]);

  const filteredSales = useMemo(() => {
    return normalizedSales.filter(item => {
      if (department && item.відділ !== department) return false;
      if (agent && item.агент !== agent) return false;

      return true;
    });
  }, [normalizedSales, department, agent]);

  const routeTodayStores = useMemo(() => {
    const normalizedRouteDay = normalizeBrand(currentRouteDay);
    const search = searchTerm.trim().toLowerCase();
    const allowedStores = new Set(
      filteredSales.map(item => item.торгова_точка)
    );
    const stores = new Set<string>();

    routes.forEach(item => {
      if (normalizeBrand(item.day) !== normalizedRouteDay) return;
      if (!allowedStores.has(item.store)) return;
      if (search && !item.store.toLowerCase().includes(search)) return;

      stores.add(item.store);
    });

    return stores;
  }, [routes, filteredSales, currentRouteDay, searchTerm]);

  const stores = useMemo<StoreAggregate[]>(() => {
    const monthSumsByStore = new Map<
      string,
      { orimi: number; delicia: number }
    >();

    filteredSales.forEach(item => {
      if (!routeTodayStores.has(item.торгова_точка)) return;

      if (isSameMonth(item.effectiveDate, currentYear, currentMonth)) {
        const storeKey = item.торгова_точка;
        const normalizedBrand = normalizeBrand(item.бренд || '');
        const current = monthSumsByStore.get(storeKey) ?? {
          orimi: 0,
          delicia: 0,
        };

        const hasBrandAccess = canUserSeeBrand(authEmail, item.бренд);
        if (!hasBrandAccess) {
          monthSumsByStore.set(storeKey, current);
          return;
        }

        if (normalizedBrand === DELICIA_NORMALIZED) {
          current.delicia += item.сума || 0;
        } else {
          current.orimi += item.сума || 0;
        }

        monthSumsByStore.set(storeKey, current);
      }
    });

    return Array.from(routeTodayStores)
      .map(store => ({
        store,
        sum: monthSumsByStore.get(store)?.orimi || 0,
        deliciaSum: Math.max(0, monthSumsByStore.get(store)?.delicia || 0),
      }))
      .sort((a, b) => storeNameCollator.compare(a.store, b.store));
  }, [
    filteredSales,
    routeTodayStores,
    currentYear,
    currentMonth,
    authEmail,
    storeNameCollator,
  ]);

  const currentMonthRouteSales = useMemo(
    () =>
      filteredSales.filter(
        item =>
          isSameMonth(item.effectiveDate, currentYear, currentMonth) &&
          routeTodayStores.has(item.торгова_точка)
      ),
    [filteredSales, currentYear, currentMonth, routeTodayStores]
  );

  const visiblePlanColumns = useMemo(
    () =>
      planColumns.filter(column => canViewPlanColumnByEmail(authEmail, column)),
    [planColumns, authEmail]
  );

  const goalCards = useMemo<GoalCard[]>(() => {
    const selectedAgent = isAgent ? ownRepresentative || '' : agent;
    const selectedDepartment = department;

    const scopeAgents = new Set(
      filteredSales.map(item => item.агент).filter(Boolean)
    );

    const resolvePlan = (column: PlanColumn): number => {
      if (selectedAgent) {
        return column.agentPlans[selectedAgent] || 0;
      }

      if (selectedDepartment) {
        const mode =
          findDepartmentMode(column, selectedDepartment) ?? 'individual';

        if (mode === 'total') {
          return findDepartmentPlan(column, selectedDepartment);
        }

        const deptAgents = new Set(
          filteredSales
            .filter(item => item.відділ === selectedDepartment)
            .map(item => item.агент)
            .filter(Boolean)
        );

        let sum = 0;
        deptAgents.forEach(agentName => {
          sum += column.agentPlans[agentName] || 0;
        });
        return sum;
      }

      let sum = 0;
      scopeAgents.forEach(agentName => {
        sum += column.agentPlans[agentName] || 0;
      });
      return sum;
    };

    return visiblePlanColumns
      .map(column => {
        const plan = resolvePlan(column);
        const ttFact = calcColumnFact(currentMonthRouteSales, column);
        const fact = getDisplayFactValue(currentMonthRouteSales, column);

        return {
          id: column.id,
          label: metricLabel(column.metric, column.threshold)
            ? `${column.label} (${metricLabel(column.metric, column.threshold)})`
            : column.label,
          metric: column.metric,
          threshold: column.threshold,
          plan,
          fact,
          colorClass: getGoalColorClass(
            column.metric,
            column.threshold,
            fact,
            ttFact
          ),
          unitLabel: getMetricUnitLabel(column.metric),
          factDetails: [],
        };
      })
      .filter(item => item.plan > 0 || item.fact > 0);
  }, [
    visiblePlanColumns,
    currentMonthRouteSales,
    filteredSales,
    department,
    agent,
    isAgent,
    ownRepresentative,
  ]);

  const storeGoalsCards = useMemo<StoreGoalsCard[]>(() => {
    if (stores.length === 0 || visiblePlanColumns.length === 0) return [];

    const salesByStore = new Map<string, Sale[]>();
    currentMonthRouteSales.forEach(sale => {
      const store = sale.торгова_точка;
      if (!store) return;
      if (!salesByStore.has(store)) salesByStore.set(store, []);
      salesByStore.get(store)?.push(sale);
    });

    const totalPlansByColumn = new Map<string, number>();
    goalCards.forEach(goal => {
      totalPlansByColumn.set(goal.id, goal.plan);
    });

    const storesCount = stores.length;

    return stores.map(storeItem => {
      const storeSales = salesByStore.get(storeItem.store) ?? [];

      const goals = visiblePlanColumns
        .map(column => {
          const totalPlan = totalPlansByColumn.get(column.id) ?? 0;
          const plan = storesCount > 0 ? totalPlan / storesCount : 0;
          const ttFact = calcColumnFact(storeSales, column);
          const fact = getDisplayFactValue(storeSales, column);

          return {
            id: column.id,
            label: metricLabel(column.metric, column.threshold)
              ? `${column.label} (${metricLabel(column.metric, column.threshold)})`
              : column.label,
            metric: column.metric,
            threshold: column.threshold,
            plan,
            fact,
            colorClass: getGoalColorClass(
              column.metric,
              column.threshold,
              fact,
              ttFact
            ),
            unitLabel: getMetricUnitLabel(column.metric),
            factDetails: isSkuMetric(column.metric)
              ? getSkuFactDetails(storeSales, column)
              : [],
          };
        })
        .filter(goal => goal.plan > 0 || goal.fact > 0);

      return {
        store: storeItem.store,
        goals,
      };
    });
  }, [stores, visiblePlanColumns, currentMonthRouteSales, goalCards]);

  const summary = useMemo(() => {
    let totalSum = 0;
    let totalDeliciaSum = 0;
    let orimiGreenStores = 0;
    let orimiYellowStores = 0;
    let orimiRedStores = 0;
    let deliciaGreenStores = 0;
    let deliciaRedStores = 0;

    stores.forEach(store => {
      totalSum += store.sum;
      totalDeliciaSum += store.deliciaSum;

      if (store.sum >= 500) {
        orimiGreenStores += 1;
      } else if (store.sum > 0) {
        orimiYellowStores += 1;
      } else {
        orimiRedStores += 1;
      }

      if (store.deliciaSum > 0) {
        deliciaGreenStores += 1;
      } else {
        deliciaRedStores += 1;
      }
    });

    return {
      activeStores: stores.length,
      totalSum,
      totalDeliciaSum,
      orimiGreenStores,
      orimiYellowStores,
      orimiRedStores,
      deliciaGreenStores,
      deliciaRedStores,
    };
  }, [stores]);

  const formatQty = (value: number) =>
    value.toLocaleString('uk-UA', {
      maximumFractionDigits: 2,
    });

  if (isLoading || isRoutesLoading || isPlanLoading) return <Loader />;
  if (error) return <div className={styles.error}>Помилка</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.pageTitle}>Цілі маршрута</h2>
        <p className={styles.pageMeta}>
          Поточний день: <b>{getDateLabel(today)}</b>
        </p>
      </header>

      <section className={styles.filtersCard}>
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
              onChange={event => setAgent(event.target.value)}
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
        <div className={styles.summaryRow}>
          <div className={styles.summaryMainGroup}>
            <span className={styles.summaryItem}>
              {searchTerm.trim() ? 'Знайдено ТТ:' : 'Активні ТТ:'}{' '}
              <b>{summary.activeStores}</b>
            </span>
            <span className={styles.summaryItem}>
              Orimi: <b>{formatQty(summary.totalSum)} грн</b>
            </span>
            {canSeeDelicia && (
              <span className={styles.summaryItem}>
                Delicia: <b>{formatQty(summary.totalDeliciaSum)} грн</b>
              </span>
            )}
          </div>

          <div className={styles.summaryTrafficGroup}>
            <div className={styles.trafficSubgroup}>
              <span className={styles.trafficLabel}>Orimi:</span>
              <span className={styles.summaryItem}>
                🟢: <b>{summary.orimiGreenStores}</b> ТТ
              </span>
              <span className={styles.summaryItem}>
                🟡: <b>{summary.orimiYellowStores}</b> ТТ
              </span>
              <span className={styles.summaryItem}>
                🔴: <b>{summary.orimiRedStores}</b> ТТ
              </span>
            </div>

            {canSeeDelicia && (
              <div className={styles.trafficSubgroup}>
                <span className={styles.trafficLabel}>Delicia:</span>
                <span className={styles.summaryItem}>
                  🟢: <b>{summary.deliciaGreenStores}</b> ТТ
                </span>
                <span className={styles.summaryItem}>
                  🔴: <b>{summary.deliciaRedStores}</b> ТТ
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.goalsHeader}>Планові показники маршрута</div>
        {storeGoalsCards.length === 0 ? (
          <p className={styles.emptyCell}>
            Немає планових показників для поточного фільтра.
          </p>
        ) : (
          <div className={styles.storeGoalsGrid}>
            {storeGoalsCards.map(storeCard => (
              <article key={storeCard.store} className={styles.storeGoalCard}>
                <button
                  type="button"
                  className={styles.storeGoalToggle}
                  onClick={() => toggleStoreGoals(storeCard.store)}
                  aria-expanded={expandedStores.includes(storeCard.store)}
                >
                  <span className={styles.storeGoalTitle}>
                    {storeCard.store}
                  </span>
                  <span className={styles.storeGoalToggleIcon}>
                    {expandedStores.includes(storeCard.store) ? '−' : '+'}
                  </span>
                </button>

                {expandedStores.includes(storeCard.store) && (
                  <div className={styles.storeGoalBody}>
                    {storeCard.goals.length === 0 ? (
                      <p className={styles.emptyCell}>
                        Немає даних по показниках.
                      </p>
                    ) : (
                      <div className={styles.goalsGrid}>
                        {storeCard.goals.map(goal => (
                          <article
                            key={`${storeCard.store}-${goal.id}`}
                            className={styles.goalCard}
                          >
                            <div className={styles.goalStats}>
                              {goal.factDetails.length > 0 ? (
                                <div className={styles.goalFactBlock}>
                                  <div className={styles.goalLabel}>
                                    {goal.label}
                                  </div>
                                  <div className={styles.goalFactDetails}>
                                    {goal.factDetails.slice(0, 6).map(item => (
                                      <span
                                        key={item}
                                        className={styles.goalFactTag}
                                      >
                                        {item}
                                      </span>
                                    ))}
                                    {goal.factDetails.length > 6 && (
                                      <span className={styles.goalFactTagMuted}>
                                        +{goal.factDetails.length - 6}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.goalInlineRow}>
                                  <span className={styles.goalLabel}>
                                    {goal.label}
                                  </span>
                                  <div
                                    className={`${styles.valueBox} ${styles.goalInlineValue} ${goal.colorClass}`}
                                  >
                                    <span className={styles.valueMain}>
                                      {formatMetricValue(
                                        goal.fact,
                                        goal.unitLabel
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <button onClick={onBack} className={styles.backButton}>
        ← Назад
      </button>
    </div>
  );
}
