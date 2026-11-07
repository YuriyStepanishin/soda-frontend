import { reorderVisibleParameters } from '../../utils/reportHierarchy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { exportSalesToExcel } from '../../utils/exportSalesToExcel';
import type { ReportExportRow } from '../../utils/exportSalesToExcel';
import { isMobileOrTablet, reportDeliveryMessage, sharePreparedReport } from '../../utils/reportDelivery';
import type { PreparedReportFile } from '../../utils/reportDelivery';
import {
  fetchSalesFilters,
  fetchSalesReport,
} from '../../api/fetchSales';
import { getActiveTenant } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import styles from './SalesPage.module.css';
import SalesFilters from '../SalesFilters/SalesFilters';
import SalesDetailed from '../SalesDetailed/SalesDetailed';
import { useSalesFilters } from '../../hooks/useSalesFilters';

type SalesPageProps = {
  onBack: () => void;
  onOpenSalesByDays: () => void;
};

const HIERARCHY_LABELS: Record<string, string> = {
  group: 'Група',
  subgroup: 'Підгрупа',
  brand: 'ТМ',
  product: 'Товар',
  date: 'Дата',
  store: 'ТТ',
  department: 'Відділ',
  agent: 'ТП',
};

export default function SalesPage({
  onBack,
  onOpenSalesByDays,
}: SalesPageProps) {
  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const ownRepresentative = getUserRepresentative(authEmail) ?? '';
  const isSupervisor = userRole === 'supervisor';
  const isAgent = userRole === 'agent';
  const activeTenant = getActiveTenant();
  const isLaska = activeTenant === 'laska';

  const {
    filters,
    updateFilters,
    applyFilters,
    backendFilters,
    options,
    setOptions,
  } = useSalesFilters();

  const [metrics, setMetrics] = useState({
    quantity: true,
    weight: true,
    amount: true,
    sku: true,
    stores: true,
  });
  const [isReportReady, setIsReportReady] = useState(false);
  const [shareWithApps, setShareWithApps] = useState(isMobileOrTablet);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const [pendingShare, setPendingShare] = useState<PreparedReportFile | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const visibleExportRows = useRef<{ source: ReportExportRow[]; rows: ReportExportRow[] } | null>(null);
  const handleVisibleRowsChange = useCallback((rows: ReportExportRow[], source: ReportExportRow[]) => {
    visibleExportRows.current = { rows, source };
  }, []);
  useEffect(() => () => exportController.current?.abort(), [activeTenant]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('uk-UA', {
        maximumFractionDigits: 2,
      }),
    []
  );

  const hasDateFrom = Boolean(filters.dateFrom);
  const hasDateTo = Boolean(filters.dateTo);
  const isValidPeriod =
    !hasDateFrom || !hasDateTo || filters.dateFrom <= filters.dateTo;
  const hasInvalidDateRange =
    hasDateFrom && hasDateTo && filters.dateFrom > filters.dateTo;

  const handleUpdateFilters = (values: Partial<typeof filters>) => {
    const nextValues = { ...values };

    if ('department' in values) {
      nextValues.agent = [];
      nextValues.stores = [];
    }

    if ('agent' in values) {
      nextValues.stores = [];
    }

    if ('groups' in values) {
      nextValues.subgroups = [];
      nextValues.brands = [];
      nextValues.products = [];
    }

    if ('subgroups' in values) {
      nextValues.brands = [];
      nextValues.products = [];
    }

    if ('brands' in values) {
      nextValues.products = [];
    }

    updateFilters(nextValues);
  };

  const safeBackendFilters = useMemo(() => {
    const nextFilters = { ...backendFilters };

    if (!isLaska) {
      Reflect.deleteProperty(nextFilters, 'groups');
      Reflect.deleteProperty(nextFilters, 'subgroups');
      Reflect.deleteProperty(nextFilters, 'packings');
    }

    if (hasInvalidDateRange) {
      Reflect.deleteProperty(nextFilters, 'dateFrom');
      Reflect.deleteProperty(nextFilters, 'dateTo');
    }

    return nextFilters;
  }, [backendFilters, hasInvalidDateRange, isLaska]);

  const liveFilterQuery = useMemo(() => {
    const nextFilters = { ...filters };

    if (!isLaska) {
      Reflect.deleteProperty(nextFilters, 'groups');
      Reflect.deleteProperty(nextFilters, 'subgroups');
      Reflect.deleteProperty(nextFilters, 'packings');
    }

    if (hasInvalidDateRange) {
      Reflect.deleteProperty(nextFilters, 'dateFrom');
      Reflect.deleteProperty(nextFilters, 'dateTo');
    }

    return nextFilters;
  }, [filters, hasInvalidDateRange, isLaska]);

  const [hierarchyOrder, setHierarchyOrder] = useState(() => {
    const defaults = Object.keys(HIERARCHY_LABELS);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('soda:sales:hierarchy-order') || 'null');
      if (Array.isArray(saved)) return [...new Set([...saved.filter((field): field is string => typeof field === 'string' && field in HIERARCHY_LABELS), ...defaults])];
    } catch { /* Use the default order if browser storage is unavailable. */ }
    return defaults;
  });
  const reportFields = useMemo(() => {
    const fields: string[] = [];

    if (isLaska && options.showGroups) fields.push('group');
    if (isLaska && options.showSubgroups) fields.push('subgroup');
    if (options.showBrands) fields.push('brand');
    if (options.showProducts) fields.push('product');
    if (options.showDates) fields.push('date');
    if (options.showByStore) fields.push('store');
    if (options.showByDepartment) fields.push('department');
    if (options.showByAgent) fields.push('agent');

    return hierarchyOrder.filter(field => fields.includes(field));
  }, [
    hierarchyOrder,
    isLaska,
    options.showByAgent,
    options.showByDepartment,
    options.showByStore,
    options.showBrands,
    options.showDates,
    options.showGroups,
    options.showProducts,
    options.showSubgroups,
  ]);

  const reportQuery = useMemo(
    () => ({
      ...safeBackendFilters,
      reportBy: reportFields.join(','),
    }),
    [safeBackendFilters, reportFields]
  );

  const { data: reportData, isFetching: reportFetching, error: reportError } = useQuery({
    queryKey: [queryKeys.sales, activeTenant, 'report', reportQuery],
    queryFn: () => fetchSalesReport(reportQuery),
    staleTime: 1000 * 60 * 5,
    enabled: isReportReady && isValidPeriod,
    placeholderData: keepPreviousData,
  });

  const { data: filtersData } = useQuery({
    queryKey: ['sales-filters', activeTenant, liveFilterQuery],
    queryFn: () => fetchSalesFilters(liveFilterQuery),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => {
      setShareWithApps(isMobileOrTablet());
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const {
    brands = [],
    groups = [],
    subgroups = [],
    stores = [],
    products = [],
    departments = [],
    agents = [],
  } = filtersData ?? {};

  const detailedRows = reportData?.rows ?? [];
  const detailedTotals = reportData?.totals ?? {
    id: 'total',
    label: 'Разом',
    quantity: 0,
    stores: 0,
    weight: 0,
    amount: 0,
    sku: 0,
  };

  const format = (n: number) => numberFormatter.format(n);

  const handleSaveExcel = async () => {
    if (!reportData || exporting || reportFetching || reportError) return;
    setExportError('');
    setExportMessage('');
    setPendingShare(null);
    setExporting(true);
    const controller = new AbortController();
    exportController.current = controller;
    try {
      const result = await exportSalesToExcel({
        rows: visibleExportRows.current?.source === reportData.rows ? visibleExportRows.current.rows : reportData.rows,
        totals: reportData.totals,
        metrics,
        title: reportTitle,
        reportMeta: selectedSummary.slice(1),
        tenant: activeTenant,
        dateFrom: backendFilters.dateFrom,
        dateTo: backendFilters.dateTo,
        shareWithApps,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setExportMessage(reportDeliveryMessage(result.status));
        setPendingShare(result.status === 'retry' ? result.file : null);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setExportError(error instanceof Error ? error.message : 'Не вдалося експортувати дані.');
      }
    } finally {
      exportController.current = null;
      setExporting(false);
    }
  };

  const handleShareSavedReport = async () => {
    if (!pendingShare || exporting) return;
    setExporting(true);
    try {
      const status = await sharePreparedReport(pendingShare);
      setExportMessage(reportDeliveryMessage(status));
      if (status !== 'retry') setPendingShare(null);
    } finally {
      setExporting(false);
    }
  };

  const handleEditReport = () => {
    exportController.current?.abort();
    setPendingShare(null);
    setExportMessage('');
    setExportError('');
    setIsReportReady(false);
  };

  const handleGenerateReport = () => {
    if (!isValidPeriod || !reportFields.length) return;

    applyFilters();
    setIsReportReady(true);
  };

  const selectedSummary = useMemo(() => {
    const period =
      filters.dateFrom || filters.dateTo
        ? `${filters.dateFrom || '...'} — ${filters.dateTo || '...'}`
        : 'Усі дати';
    const parts = [period];

    if (filters.department.length)
      parts.push(`Відділ: ${filters.department.join(', ')}`);
    if (filters.agent.length) parts.push(`ТП: ${filters.agent.join(', ')}`);
    if (isLaska && filters.groups.length)
      parts.push(`Груп: ${filters.groups.length}`);
    if (isLaska && filters.subgroups.length)
      parts.push(`Підгруп: ${filters.subgroups.length}`);
    if (filters.stores.length) parts.push(`ТТ: ${filters.stores.length}`);
    if (filters.brands.length) parts.push(`ТМ: ${filters.brands.length}`);
    if (filters.products.length)
      parts.push(`Товарів: ${filters.products.length}`);
    parts.push(
      `Ієрархія: ${reportFields.map(field => HIERARCHY_LABELS[field]).join(' → ')}`
    );

    return parts;
  }, [filters, isLaska, reportFields]);

  const reportTitle = 'Звіт по вибраній ієрархії';

  const handleBack = () => {
    if (isReportReady) {
      handleEditReport();
      return;
    }

    onBack();
  };

  return (
    <div className={styles.container}>
      <div className={styles.desktopLayout}>
        {!isReportReady ? (
          <SalesFilters
            filters={filters}
            updateFilters={handleUpdateFilters}
            departments={departments}
            agents={agents}
            stores={stores}
            brands={brands}
            groups={groups}
            subgroups={subgroups}
            products={products}
            isLaska={isLaska}
            showDepartment={!isSupervisor && !isAgent}
            showAgent={!isAgent}
            representativeLabel={ownRepresentative}
            hierarchyOrder={hierarchyOrder}
            onHierarchyOrderChange={ordered => {
              setHierarchyOrder(previous => {
                const next = reorderVisibleParameters(previous, ordered);
                try { localStorage.setItem('soda:sales:hierarchy-order', JSON.stringify(next)); } catch { /* Keep order for this session. */ }
                return next;
              });
            }}
            options={options}
            metrics={metrics}
            onChangeOptions={setOptions}
            onChangeMetrics={setMetrics}
            onApplyFilters={handleGenerateReport}
            onOpenSalesByDays={onOpenSalesByDays}
            dateError={
              hasInvalidDateRange
                ? 'Дата "від" не може бути більшою за дату "до".'
                : undefined
            }
          />
        ) : (
          <section className={styles.reportBar}>
            <div className={styles.reportSummary}>
              {selectedSummary.map(item => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className={styles.reportActions}>
              <button type="button" onClick={handleEditReport}>
                Змінити
              </button>
              <button type="button" disabled={exporting || !reportData || reportFetching || Boolean(reportError)} onClick={() => void handleSaveExcel()}>
                {exporting ? 'Підготовка…' : shareWithApps ? 'Зберегти та відправити' : 'Зберегти Excel'}
              </button>
              {shareWithApps && pendingShare ? (
                <button type="button" disabled={exporting} onClick={() => void handleShareSavedReport()}>Вибрати програму</button>
              ) : null}
            </div>
            {exportMessage ? <p role="status">{exportMessage}</p> : null}
            {exportError ? <p role="alert">{exportError}</p> : null}
          </section>
        )}

        <div className={styles.reportContent}>
          {isReportReady && reportFetching ? <p role="status">Формування звіту…</p> : null}
          {isReportReady && reportError ? <p role="alert">{reportError.message}</p> : null}
          {isReportReady ? (
            <SalesDetailed
              hierarchyFields={reportFields}
              rows={detailedRows}
              totals={detailedTotals}
              metrics={metrics}
              format={format}
              title={reportTitle}
              reportMeta={selectedSummary}
              onVisibleRowsChange={handleVisibleRowsChange}
            />
          ) : (
            <div className={styles.emptyReport}>
              Оберіть фільтри, параметри та показники, потім натисніть
              «Сформувати».
            </div>
          )}
        </div>
      </div>

      <button onClick={handleBack} className={styles.button}>
        {isReportReady ? '← До параметрів' : '← Назад'}
      </button>
    </div>
  );
}
