import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './InfoBoardPage.module.css';
import { canUserSeeBrand, getUserRole } from '../../config/userRoles';
import { useMessagesCenter } from '../../hooks/useMessagesCenter';
import { fetchSales, type Sale } from '../../api/fetchOlgatorgSales';
import { fetchReports, type Report } from '../../api/fetchReports';
import { queryKeys } from '../../api/queryKeys';
import { loadPlanColumns } from '../ImplementationPage/planColumnsStorage';
import {
  canViewPlanColumnByEmail,
  calcColumnFact,
  isGrnMetric,
  type PlanColumn,
} from '../ImplementationPage/planColumnsStorage';

import type {
  MessageItem,
  SendMessagePayload,
  MessageFeedbackPayload,
} from '../../types/message';
import type { Attachment } from '../../types/photo';

type TopClientRow = {
  name: string;
  value: number;
};

type TopProductRow = {
  name: string;
  quantity: number;
  value: number;
};

function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;

  const monthNames = [
    'січень',
    'лютий',
    'березень',
    'квітень',
    'травень',
    'червень',
    'липень',
    'серпень',
    'вересень',
    'жовтень',
    'листопад',
    'грудень',
  ];

  const monthIndex = Number(match[2]) - 1;
  const monthName = monthNames[monthIndex] || match[2];
  return `${monthName} ${match[1]}`;
}

function parseSaleDateKey(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';

  const dmy = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getKyivDateParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find(entry => entry.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
}

function getWorkingDayStats(
  year: number,
  month: number,
  day: number
): {
  total: number;
  elapsed: number;
} {
  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  let elapsed = 0;

  for (let currentDay = 1; currentDay <= daysInMonth; currentDay += 1) {
    const isWeekend =
      new Date(year, month - 1, currentDay, 12).getDay() % 6 === 0;
    if (isWeekend) continue;

    total += 1;
    if (currentDay < day) elapsed += 1;
  }

  return { total, elapsed };
}

function sumPlanTargets(column: PlanColumn): number {
  const deptPlanTotal = Object.values(column.deptPlans ?? {}).reduce(
    (sum, value) => sum + (value || 0),
    0
  );

  if (deptPlanTotal > 0) return deptPlanTotal;

  return Object.values(column.agentPlans ?? {}).reduce(
    (sum, value) => sum + (value || 0),
    0
  );
}

function formatMetricValue(
  value: number,
  grn: boolean,
  formatter: Intl.NumberFormat
): string {
  return grn ? `${formatter.format(value)} ₴` : formatter.format(value);
}

function formatForecastValue(
  value: number,
  grn: boolean,
  formatter: Intl.NumberFormat
): string {
  return grn ? `${formatter.format(value)} ₴` : formatter.format(value);
}

function formatPercentValue(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface Props {
  userEmail: string;
  onBack: () => void;
  messagesCenter?: ReturnType<typeof useMessagesCenter>;
}

// --- InfoBoardComposePanel ---
type InfoBoardComposePanelProps = {
  userEmail: string;
  sendMessage: (
    payload: SendMessagePayload & { attachments?: Attachment[] }
  ) => Promise<{ success: boolean; error?: string }>;
  isSending: boolean;
};
function InfoBoardComposePanel(props: InfoBoardComposePanelProps) {
  // TODO: реалізувати форму додавання оголошення
  return (
    <div className={styles.composePanel}>
      <button className={styles.addButton} disabled={props.isSending}>
        + Додати оголошення
      </button>
      {/* TODO: форма додавання/редагування */}
    </div>
  );
}

// --- AgentFeedbackBox ---
type AgentFeedbackBoxProps = {
  messageId: string;
  userEmail: string;
  sendFeedback: (
    payload: MessageFeedbackPayload
  ) => Promise<{ success: boolean; error?: string }>;
  isSending: boolean;
};
function AgentFeedbackBox(props: AgentFeedbackBoxProps) {
  // TODO: реалізувати форму коментаря
  return (
    <div className={styles.feedbackBox}>
      <textarea placeholder="Ваш коментар..." disabled={props.isSending} />
      <button className={styles.sendButton} disabled={props.isSending}>
        Надіслати
      </button>
      {/* TODO: реалізувати відправку коментаря */}
    </div>
  );
}

export default function InfoBoardPage({
  userEmail,
  onBack,
  messagesCenter,
}: Props) {
  const localCenter = useMessagesCenter(userEmail);
  const center = messagesCenter ?? localCenter;
  const userRole = useMemo(() => getUserRole(userEmail), [userEmail]);
  const isAdmin = userRole === 'admin';
  const isSupervisor = userRole === 'supervisor';
  const isManager = isAdmin || isSupervisor;
  const isAgent = userRole === 'agent';

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('uk-UA', {
        maximumFractionDigits: 0,
      }),
    []
  );

  const integerFormatter = useMemo(
    () =>
      new Intl.NumberFormat('uk-UA', {
        maximumFractionDigits: 0,
      }),
    []
  );

  const { data: planColumns = [], isLoading: planColumnsLoading } = useQuery<
    PlanColumn[]
  >({
    queryKey: queryKeys.infoBoardPlanTargets,
    queryFn: loadPlanColumns,
    staleTime: 1000 * 60 * 5,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: queryKeys.homeSalesPreview,
    queryFn: fetchSales,
    staleTime: 1000 * 60 * 5,
  });

  const { data: photoReports = [] } = useQuery<Report[]>({
    queryKey: queryKeys.homePhotoReportsPreview,
    queryFn: fetchReports,
    staleTime: 1000 * 60 * 5,
  });

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  const currentMonthSales = useMemo(
    () =>
      sales.filter(
        row =>
          row.відділ !== 'Офіс' &&
          parseSaleDateKey(row.дата || '').startsWith(currentMonthKey)
      ),
    [sales, currentMonthKey]
  );

  const kyivDateParts = useMemo(() => getKyivDateParts(), []);

  const workingDayStats = useMemo(
    () =>
      getWorkingDayStats(
        kyivDateParts.year,
        kyivDateParts.month,
        kyivDateParts.day
      ),
    [kyivDateParts]
  );

  const salesInsights = useMemo(() => {
    const currentMonthKey = getCurrentMonthKey();
    const storeAmount: Record<string, number> = {};
    const storeSkuSet: Record<string, Set<string>> = {};
    const productQuantity: Record<string, number> = {};
    const productAmount: Record<string, number> = {};
    const stores = new Set<string>();

    let totalAmount = 0;

    sales.forEach(row => {
      const amount = row.сума || 0;
      const quantity = row.кількість || 0;
      const product = (row.товар || '').trim();
      const store = (row.торгова_точка || '').trim();
      const dateKey = parseSaleDateKey(row.дата || '');
      if (!dateKey || !dateKey.startsWith(currentMonthKey)) return;
      if (!canUserSeeBrand(userEmail, row.бренд)) return;

      totalAmount += amount;

      if (store) {
        stores.add(store);
        storeAmount[store] = (storeAmount[store] || 0) + amount;
      }
      if (product) {
        productQuantity[product] = (productQuantity[product] || 0) + quantity;
        productAmount[product] = (productAmount[product] || 0) + amount;
      }
      if (store && product) {
        if (!storeSkuSet[store]) storeSkuSet[store] = new Set<string>();
        storeSkuSet[store].add(product);
      }
    });

    const topClients: TopClientRow[] = Object.entries(storeAmount)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const productStats: TopProductRow[] = Object.entries(productQuantity).map(
      ([name, quantity]) => ({
        name,
        quantity,
        value: productAmount[name] || 0,
      })
    );

    const topProductsByQuantity = productStats
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topProductsByAmount = [...productStats]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const topClientsSku: TopClientRow[] = Object.entries(storeSkuSet)
      .map(([name, skuSet]) => ({ name, value: skuSet.size }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      currentMonthKey,
      totalAmount,
      storesCount: stores.size,
      topClients,
      topProductsByQuantity,
      topProductsByAmount,
      topClientsSku,
    };
  }, [sales, userEmail]);

  const currentMonthLabel = formatMonthLabel(salesInsights.currentMonthKey);

  const photoReportsTtCount = useMemo(() => {
    const storesInReports = new Set<string>();

    photoReports.forEach(report => {
      const dateKey = parseSaleDateKey(report.date || '');
      if (!dateKey || !dateKey.startsWith(currentMonthKey)) return;

      const store = (report.store || '').trim();
      if (store) storesInReports.add(store);
    });

    return storesInReports.size;
  }, [photoReports, currentMonthKey]);

  const remainingTargets = useMemo(() => {
    const visibleColumns = planColumns.filter(column =>
      canViewPlanColumnByEmail(userEmail, column)
    );

    return visibleColumns
      .map(column => {
        const plan = sumPlanTargets(column);
        const fact = calcColumnFact(currentMonthSales, column);
        const forecast =
          workingDayStats.elapsed > 0
            ? (fact / workingDayStats.elapsed) * (workingDayStats.total - 1)
            : 0;
        const factPercent = plan > 0 ? (fact / plan) * 100 : 0;
        const forecastPercent = plan > 0 ? (forecast / plan) * 100 : 0;
        return {
          id: column.id,
          label: column.label,
          plan,
          fact,
          forecast,
          factPercent,
          forecastPercent,
          remaining: Math.max(plan - fact, 0),
          grn: isGrnMetric(column.metric),
        };
      })
      .filter(item => item.plan > 0 || item.fact > 0);
  }, [
    currentMonthSales,
    planColumns,
    userEmail,
    workingDayStats.elapsed,
    workingDayStats.total,
  ]);

  const maxProductQty =
    salesInsights.topProductsByQuantity.length > 0
      ? Math.max(
          ...salesInsights.topProductsByQuantity.map(item => item.quantity),
          1
        )
      : 1;

  const maxProductAmount =
    salesInsights.topProductsByAmount.length > 0
      ? Math.max(
          ...salesInsights.topProductsByAmount.map(item => item.value),
          1
        )
      : 1;

  const maxClientAmount =
    salesInsights.topClients.length > 0
      ? Math.max(...salesInsights.topClients.map(item => item.value), 1)
      : 1;

  const maxClientSku =
    salesInsights.topClientsSku.length > 0
      ? Math.max(...salesInsights.topClientsSku.map(item => item.value), 1)
      : 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Назад
        </button>
        <h1 className={styles.title}>Дошка інформації</h1>
      </div>

      {/* Додавання оголошення — лише для керівника/супервайзера */}
      {isManager && (
        <InfoBoardComposePanel
          userEmail={userEmail}
          sendMessage={center.sendMessage}
          isSending={center.isSendingMessage}
        />
      )}

      <section className={styles.dashboardArea}>
        <article className={styles.dashboardCard}>
          <h2 className={styles.dashboardTitle}>
            Найпопулярніші продажі ({currentMonthLabel})
          </h2>
          <div className={styles.kpiRow}>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Сума продажів</span>
              <strong className={styles.kpiValue}>
                {moneyFormatter.format(salesInsights.totalAmount)} ₴
              </strong>
            </div>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Активні ТТ</span>
              <strong className={styles.kpiValue}>
                {integerFormatter.format(salesInsights.storesCount)}
              </strong>
            </div>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Кількість ТТ у фотозвітах</span>
              <strong className={styles.kpiValue}>
                {integerFormatter.format(photoReportsTtCount)}
              </strong>
            </div>
          </div>
        </article>

        <div className={styles.dashboardGrid}>
          <article className={styles.chartCard}>
            <h3 className={styles.chartTitle}>ТОП 10 клієнтів</h3>
            {salesLoading ? (
              <p className={styles.chartHint}>Завантаження...</p>
            ) : salesInsights.topClients.length === 0 ? (
              <p className={styles.chartHint}>Немає даних для графіка</p>
            ) : (
              <ul className={styles.barList}>
                {salesInsights.topClients.map(item => (
                  <li key={item.name} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{item.name}</span>
                      <span className={styles.barValue}>
                        {moneyFormatter.format(item.value)} ₴
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${(item.value / maxClientAmount) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Топ 10 товарів (шт)</h3>
            {salesLoading ? (
              <p className={styles.chartHint}>Завантаження...</p>
            ) : salesInsights.topProductsByQuantity.length === 0 ? (
              <p className={styles.chartHint}>Немає даних для графіка</p>
            ) : (
              <ul className={styles.barList}>
                {salesInsights.topProductsByQuantity.map(item => (
                  <li key={item.name} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{item.name}</span>
                      <span className={styles.barValue}>
                        {integerFormatter.format(item.quantity)}
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillAlt}
                        style={{
                          width: `${(item.quantity / maxProductQty) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Топ 10 товарів (грн)</h3>
            {salesLoading ? (
              <p className={styles.chartHint}>Завантаження...</p>
            ) : salesInsights.topProductsByAmount.length === 0 ? (
              <p className={styles.chartHint}>Немає даних для графіка</p>
            ) : (
              <ul className={styles.barList}>
                {salesInsights.topProductsByAmount.map(item => (
                  <li key={item.name} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{item.name}</span>
                      <span className={styles.barValue}>
                        {moneyFormatter.format(item.value)} ₴
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillAlt}
                        style={{
                          width: `${(item.value / maxProductAmount) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              ТОП 10 клієнтів по кількості SKU
            </h3>
            {salesLoading ? (
              <p className={styles.chartHint}>Завантаження...</p>
            ) : salesInsights.topClientsSku.length === 0 ? (
              <p className={styles.chartHint}>Немає даних для графіка</p>
            ) : (
              <ul className={styles.barList}>
                {salesInsights.topClientsSku.map(item => (
                  <li key={item.name} className={styles.barItem}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{item.name}</span>
                      <span className={styles.barValue}>
                        {integerFormatter.format(item.value)} SKU
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFillWarn}
                        style={{
                          width: `${(item.value / maxClientSku) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>

      {/* Список оголошень */}
      <div className={styles.inboxPanel}>
        {center.isLoading ? (
          <div>Завантаження...</div>
        ) : center.messages.length === 0 ? (
          <div>Немає оголошень</div>
        ) : (
          (center.messages as MessageItem[]).map(msg => (
            <div key={msg.id} className={styles.messageCard}>
              <div className={styles.messageHeader}>
                <b>{msg.title}</b>
                <span className={styles.messageMeta}>
                  {msg.senderName || msg.senderEmail} |{' '}
                  {new Date(msg.createdAt).toLocaleString('uk-UA')}
                </span>
              </div>
              <div className={styles.messageBody}>{msg.body}</div>

              {/* Відображення прикріплених файлів */}
              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                <div className={styles.attachmentsBox}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Файли:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(msg.attachments as Attachment[]).map((file, idx) => {
                      if (!file.url) return null;
                      const type = file.type || '';
                      if (type.startsWith('image/')) {
                        return (
                          <img
                            key={idx}
                            src={file.url}
                            alt={file.name}
                            style={{
                              maxWidth: 120,
                              maxHeight: 120,
                              borderRadius: 8,
                            }}
                          />
                        );
                      }
                      if (type === 'application/pdf') {
                        return (
                          <embed
                            key={idx}
                            src={file.url}
                            type="application/pdf"
                            width="120"
                            height="120"
                            style={{ borderRadius: 8 }}
                          />
                        );
                      }
                      if (
                        type.includes('excel') ||
                        (file.name || '').endsWith('.xls') ||
                        (file.name || '').endsWith('.xlsx')
                      ) {
                        return (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block' }}
                          >
                            {file.name}
                          </a>
                        );
                      }
                      if (
                        type.includes('word') ||
                        (file.name || '').endsWith('.doc') ||
                        (file.name || '').endsWith('.docx')
                      ) {
                        return (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block' }}
                          >
                            {file.name}
                          </a>
                        );
                      }
                      return (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'block' }}
                        >
                          {file.name || 'Файл'}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Для агентів — поле для коментаря */}
              {isAgent && (
                <AgentFeedbackBox
                  messageId={msg.id}
                  userEmail={userEmail}
                  sendFeedback={center.sendFeedback}
                  isSending={center.isSendingFeedback}
                />
              )}

              {/* Для керівника/супервайзера — кнопки редагування/видалення */}
              {isManager && (
                <div className={styles.messageActions}>
                  <button className={styles.editButton} disabled>
                    Редагувати
                  </button>
                  <button className={styles.deleteButton} disabled>
                    Видалити
                  </button>
                  {/* TODO: реалізувати редагування/видалення */}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <article className={styles.dashboardCard}>
        <h2 className={styles.dashboardTitle}>Виконання показників</h2>
        <p className={styles.remainingHint}>
          Прогноз розраховано за робочими днями місяця без суботи та неділі.
        </p>
        {planColumnsLoading ? (
          <p className={styles.chartHint}>Завантаження...</p>
        ) : remainingTargets.length === 0 ? (
          <p className={styles.chartHint}>Немає даних для таблиці</p>
        ) : (
          <div className={styles.remainingTableWrap}>
            <table className={styles.remainingTable}>
              <thead>
                <tr>
                  <th className={styles.remainingTitleCell}>Показник</th>
                  <th className={styles.remainingNumCell}>ПЛАН</th>
                  <th className={styles.remainingNumCell}>ФАКТ</th>
                  <th className={styles.remainingNumCell}>%%</th>
                  <th className={styles.remainingNumCell}>ЗАЛИШОК</th>
                  <th className={styles.remainingNumCell}>ПРОГНОЗ</th>
                  <th className={styles.remainingNumCell}>ПРОГНОЗ %%</th>
                </tr>
              </thead>
              <tbody>
                {remainingTargets.map(item => (
                  <tr key={item.id}>
                    <td
                      className={styles.remainingNameCell}
                      data-label="Показник"
                    >
                      {item.label}
                    </td>
                    <td className={styles.remainingNumCell} data-label="ПЛАН">
                      {formatMetricValue(item.plan, item.grn, integerFormatter)}
                    </td>
                    <td className={styles.remainingNumCell} data-label="ФАКТ">
                      {formatMetricValue(item.fact, item.grn, integerFormatter)}
                    </td>
                    <td className={styles.remainingNumCell} data-label="%%">
                      {formatPercentValue(item.factPercent)}
                    </td>
                    <td
                      data-label="ЗАЛИШОК"
                      className={`${styles.remainingNumCell} ${
                        item.remaining > 0
                          ? styles.remainingWarn
                          : styles.remainingGood
                      }`}
                    >
                      {formatMetricValue(
                        item.remaining,
                        item.grn,
                        integerFormatter
                      )}
                    </td>
                    <td
                      data-label="ПРОГНОЗ"
                      className={`${styles.remainingNumCell} ${
                        item.forecast >= item.plan
                          ? styles.remainingGood
                          : styles.remainingWarn
                      }`}
                    >
                      {formatForecastValue(
                        item.forecast,
                        item.grn,
                        integerFormatter
                      )}
                    </td>
                    <td
                      data-label="ПРОГНОЗ %%"
                      className={`${styles.remainingNumCell} ${
                        item.forecastPercent >= 100
                          ? styles.remainingGood
                          : item.forecastPercent >= 80
                            ? styles.remainingWarn
                            : styles.remainingDanger
                      }`}
                    >
                      {formatPercentValue(item.forecastPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
