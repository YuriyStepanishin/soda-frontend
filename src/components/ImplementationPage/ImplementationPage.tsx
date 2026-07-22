import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSales, type Sale } from '../../api/fetchSales';
import Loader from '../Loader/Loader';
import {
  getCurrentAuthorizedEmail,
  getUserDepartment,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import { DEPARTMENT_ORDER } from './agentsConfig';
import {
  loadPlanColumns,
  canViewPlanColumnByEmail,
  calcColumnFact,
  calcColumnFactDetailsByStore,
  isGrnMetric,
  type PlanColumn,
  type StoreFactDetail,
} from './planColumnsStorage';
import { queryKeys } from '../../api/queryKeys';
import styles from './ImplementationPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function getRenderableDepartmentsByScope() {
  const authEmail = getCurrentAuthorizedEmail();
  const role = getUserRole(authEmail);
  const department = getUserDepartment(authEmail);

  if (role === 'agent') {
    const representative = getUserRepresentative(authEmail);
    if (!department || !representative) return DEPARTMENT_ORDER;
    const allowed = department.split(',').map(part => normalizeText(part));
    const deptEntry = DEPARTMENT_ORDER.find(item => {
      const itemDept = normalizeText(item.dept);
      if (itemDept.includes('місто+область (центр)')) {
        return (
          allowed.some(value => value.includes('місто')) ||
          allowed.some(value => value.includes('область'))
        );
      }
      return allowed.some(value => itemDept.includes(value));
    });
    if (!deptEntry) return [];
    return [{ ...deptEntry, agents: [representative] }];
  }

  if (role !== 'supervisor' || !department) {
    return DEPARTMENT_ORDER;
  }

  const allowed = department.split(',').map(part => normalizeText(part));
  return DEPARTMENT_ORDER.filter(item => {
    const itemDept = normalizeText(item.dept);
    if (itemDept.includes('місто+область (центр)')) {
      return (
        allowed.some(value => value.includes('місто')) ||
        allowed.some(value => value.includes('область'))
      );
    }
    return allowed.some(value => itemDept.includes(value));
  });
}

function getCurrentMonthKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}`;
}

function parseDateMonth(raw: string): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return null;
}

function parseDateISO(raw: string): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return null;
}

function formatKyivDateTime(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function pct(fact: number, plan: number): string {
  if (plan === 0) return '—';
  return ((fact / plan) * 100).toFixed(1) + '%';
}

function fmt(n: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(n);
}

function fmtFact(n: number, grn: boolean): string {
  return grn ? fmt(n) : fmt(Math.round(n * 10) / 10);
}

function getPctClass(
  fact: number,
  plan: number,
  s: Record<string, string>
): string {
  if (plan === 0) return '';
  const ratio = fact / plan;
  if (ratio >= 1) return s.pctGood;
  if (ratio >= 0.75) return s.pctMid;
  return s.pctBad;
}

function buildAgentSalesIndex(sales: Sale[]): Record<string, Sale[]> {
  const index: Record<string, Sale[]> = {};
  for (const s of sales) {
    if (!s.агент) continue;
    if (!index[s.агент]) index[s.агент] = [];
    index[s.агент].push(s);
  }
  return index;
}

type ColValues = { plan: number; fact: number };
type DataRow = {
  type: 'dept' | 'agent';
  label: string;
  cols: ColValues[];
};

type DetailModalState = {
  title: string;
  grn: boolean;
  items: StoreFactDetail[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImplementationPage({ onBack }: { onBack: () => void }) {
  const authEmail = getCurrentAuthorizedEmail();
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const renderDepartments = useMemo(
    () => getRenderableDepartmentsByScope(),
    []
  );

  const {
    data = [],
    isLoading,
    error,
  } = useQuery<Sale[]>({
    queryKey: queryKeys.sales,
    queryFn: fetchSales,
    staleTime: 1000 * 60 * 5,
  });

  const { data: planColumns = [], isLoading: isPlanLoading } = useQuery<
    PlanColumn[]
  >({
    queryKey: queryKeys.planTargets,
    queryFn: loadPlanColumns,
    staleTime: 1000 * 60 * 5,
  });

  const currentMonth = useMemo(() => getCurrentMonthKey(), []);

  const visiblePlanColumns = useMemo(
    () =>
      planColumns.filter(column => canViewPlanColumnByEmail(authEmail, column)),
    [planColumns, authEmail]
  );

  const currentMonthSales = useMemo(
    () => data.filter(s => parseDateMonth(s.дата) === currentMonth),
    [data, currentMonth]
  );

  const agentSalesIndex = useMemo(
    () => buildAgentSalesIndex(currentMonthSales),
    [currentMonthSales]
  );

  const lastUpdated = useMemo(() => {
    let maxDate = '';
    for (const s of currentMonthSales) {
      const iso = parseDateISO(s.дата);
      if (iso && iso > maxDate) maxDate = iso;
    }
    return maxDate ? formatKyivDateTime(maxDate) : null;
  }, [currentMonthSales]);

  const { rows, totals } = useMemo(() => {
    const rows: DataRow[] = [];
    const totalCols: ColValues[] = visiblePlanColumns.map(() => ({
      plan: 0,
      fact: 0,
    }));

    for (const dept of renderDepartments) {
      const deptCols: ColValues[] = visiblePlanColumns.map(() => ({
        plan: 0,
        fact: 0,
      }));
      const agentRows: DataRow[] = [];

      for (const agent of dept.agents) {
        const agentSales = agentSalesIndex[agent] ?? [];
        const cols: ColValues[] = visiblePlanColumns.map((col, ci) => {
          const fact = calcColumnFact(agentSales, col);
          // If this dept uses total mode for the column, individual agent plan is not shown
          const plan =
            (col.deptMode?.[dept.dept] ?? 'individual') === 'total'
              ? 0
              : (col.agentPlans[agent] ?? 0);
          deptCols[ci].fact += fact;
          deptCols[ci].plan += plan;
          return { plan, fact };
        });

        agentRows.push({ type: 'agent', label: agent, cols });
      }

      rows.push({
        type: 'dept',
        label: dept.label,
        cols: deptCols.map((dc, ci) => {
          const col = visiblePlanColumns[ci];
          // If dept uses total mode for this column, use deptPlans instead of agent sum
          const plan =
            (col.deptMode?.[dept.dept] ?? 'individual') === 'total'
              ? (col.deptPlans?.[dept.dept] ?? 0)
              : dc.plan;
          return { plan, fact: dc.fact };
        }),
      });
      rows.push(...agentRows);
      deptCols.forEach((dc, ci) => {
        const col = visiblePlanColumns[ci];
        const dPlan =
          (col.deptMode?.[dept.dept] ?? 'individual') === 'total'
            ? (col.deptPlans?.[dept.dept] ?? 0)
            : dc.plan;
        totalCols[ci].plan += dPlan;
        totalCols[ci].fact += dc.fact;
      });
    }

    return { rows, totals: { cols: totalCols } };
  }, [renderDepartments, agentSalesIndex, visiblePlanColumns]);

  const monthLabel = new Date().toLocaleString('uk-UA', {
    month: 'long',
    year: 'numeric',
  });

  function openFactDetails(
    rowType: 'dept' | 'agent' | 'total',
    rowLabel: string,
    columnIndex: number
  ) {
    const column = visiblePlanColumns[columnIndex];
    if (!column) return;

    let scopeSales: Sale[] = [];
    if (rowType === 'total') {
      scopeSales = currentMonthSales;
    } else if (rowType === 'agent') {
      scopeSales = agentSalesIndex[rowLabel] ?? [];
    } else {
      const dept = renderDepartments.find(item => item.label === rowLabel);
      if (!dept) return;
      scopeSales = dept.agents.flatMap(agent => agentSalesIndex[agent] ?? []);
    }

    const items = calcColumnFactDetailsByStore(scopeSales, column);
    setDetailModal({
      title: `${rowLabel} - ${column.label}`,
      grn: isGrnMetric(column.metric),
      items,
    });
  }

  if (isLoading || isPlanLoading) return <Loader />;
  if (error) return <div className={styles.error}>Помилка завантаження</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Виконання показників</h2>
        <span className={styles.monthBadge}>{monthLabel}</span>
      </div>

      {lastUpdated && (
        <p className={styles.updatedAt}>
          Дані оновлено: <strong>{lastUpdated}</strong>
        </p>
      )}

      {/* ── DESKTOP ── */}
      <div className={`${styles.tableWrapper} ${styles.desktopOnly}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colDept} rowSpan={2}>
                Відділ / ТП
              </th>
              {visiblePlanColumns.map(col => (
                <th key={col.id} className={styles.colGroup} colSpan={3}>
                  {col.label}
                </th>
              ))}
            </tr>
            <tr>
              {visiblePlanColumns.map(col => (
                <ColumnSubHeaders key={col.id} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={
                  row.type === 'dept' ? styles.deptRow : styles.agentRow
                }
              >
                <td className={styles.nameCell}>{row.label}</td>
                {row.cols.map((c, ci) => (
                  <ColCells
                    key={ci}
                    plan={c.plan}
                    fact={c.fact}
                    grn={isGrnMetric(visiblePlanColumns[ci].metric)}
                    styles={styles}
                    onFactClick={() => openFactDetails(row.type, row.label, ci)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td className={styles.nameCell}>Загальний підсумок</td>
              {totals.cols.map((c, ci) => (
                <ColCells
                  key={ci}
                  plan={c.plan}
                  fact={c.fact}
                  grn={isGrnMetric(visiblePlanColumns[ci].metric)}
                  styles={styles}
                  onFactClick={() =>
                    openFactDetails('total', 'Загальний підсумок', ci)
                  }
                />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── MOBILE ── */}
      <div className={styles.mobileOnly}>
        {visiblePlanColumns.map((col, ci) => {
          const grn = isGrnMetric(col.metric);
          return (
            <div key={col.id}>
              <p className={styles.mobileTableTitle}>{col.label}</p>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colDept}>Відділ / ТП</th>
                      <th className={styles.colSub}>ПЛАН</th>
                      <th className={styles.colSub}>ФАКТ</th>
                      <th className={styles.colSub}>%%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const c = row.cols[ci];
                      return (
                        <tr
                          key={i}
                          className={
                            row.type === 'dept'
                              ? styles.deptRow
                              : styles.agentRow
                          }
                        >
                          <td className={styles.nameCell}>{row.label}</td>
                          <td className={styles.numCell}>
                            {grn ? fmt(c.plan) : c.plan}
                          </td>
                          <td className={styles.numCell}>
                            <button
                              type="button"
                              className={styles.factButton}
                              onClick={() =>
                                openFactDetails(row.type, row.label, ci)
                              }
                            >
                              {fmtFact(c.fact, grn)}
                            </button>
                          </td>
                          <td
                            className={`${styles.numCell} ${styles.pctCell} ${getPctClass(c.fact, c.plan, styles)}`}
                          >
                            {pct(c.fact, c.plan)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td className={styles.nameCell}>Загальний підсумок</td>
                      <td className={styles.numCell}>
                        {grn ? fmt(totals.cols[ci].plan) : totals.cols[ci].plan}
                      </td>
                      <td className={styles.numCell}>
                        <button
                          type="button"
                          className={styles.factButton}
                          onClick={() =>
                            openFactDetails('total', 'Загальний підсумок', ci)
                          }
                        >
                          {fmtFact(totals.cols[ci].fact, grn)}
                        </button>
                      </td>
                      <td
                        className={`${styles.numCell} ${styles.pctCell} ${getPctClass(totals.cols[ci].fact, totals.cols[ci].plan, styles)}`}
                      >
                        {pct(totals.cols[ci].fact, totals.cols[ci].plan)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <button className={styles.backBtn} onClick={onBack}>
        ← Назад
      </button>

      {detailModal && (
        <div className={styles.modalLayer}>
          <div
            className={styles.modalBackdrop}
            onClick={() => setDetailModal(null)}
          />
          <div className={styles.modalDialog} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{detailModal.title}</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDetailModal(null)}
                aria-label="Закрити"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {detailModal.items.length === 0 ? (
                <p className={styles.emptyText}>
                  Немає даних по торгових точках
                </p>
              ) : (
                <table className={styles.detailsTable}>
                  <thead>
                    <tr>
                      <th>Торгова точка</th>
                      <th>Показник</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailModal.items.map(item => (
                      <tr key={item.store}>
                        <td>{item.store}</td>
                        <td>{fmtFact(item.value, detailModal.grn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnSubHeaders() {
  return (
    <>
      <th className={styles.colSub}>ПЛАН</th>
      <th className={styles.colSub}>ФАКТ</th>
      <th className={styles.colSub}>%%</th>
    </>
  );
}

function ColCells({
  plan,
  fact,
  grn,
  onFactClick,
  styles: s,
}: {
  plan: number;
  fact: number;
  grn: boolean;
  onFactClick: () => void;
  styles: Record<string, string>;
}) {
  return (
    <>
      <td className={s.numCell}>{grn ? fmt(plan) : plan}</td>
      <td className={s.numCell}>
        <button type="button" className={s.factButton} onClick={onFactClick}>
          {fmtFact(fact, grn)}
        </button>
      </td>
      <td className={`${s.numCell} ${s.pctCell} ${getPctClass(fact, plan, s)}`}>
        {pct(fact, plan)}
      </td>
    </>
  );
}
