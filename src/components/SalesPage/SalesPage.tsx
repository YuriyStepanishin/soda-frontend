import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { exportSalesToExcel } from '../../utils/exportSalesToExcel';
import {
  fetchSales,
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

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

    return fields.length ? fields : ['brand'];
  }, [
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

  const { data: reportData } = useQuery({
    queryKey: [queryKeys.sales, 'report', reportQuery],
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
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
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
    if (!reportData) return;

    const sales = await fetchSales({
      ...safeBackendFilters,
      page: 1,
      limit: 50000,
    });

    const brandsList = reportData.rows.map(item => ({
      brand: item.label,
      stores: item.stores,
      weight: item.weight,
      amount: item.amount,
    }));

    await exportSalesToExcel({
      sales,
      brandsList,
      totalRow: reportData.totals,
      agent: filters.agent,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      isMobile,
    });
  };

  const handleGenerateReport = () => {
    if (!isValidPeriod) return;

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
      setIsReportReady(false);
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
              <button type="button" onClick={() => setIsReportReady(false)}>
                Змінити
              </button>
              <button type="button" onClick={() => void handleSaveExcel()}>
                {isMobile ? 'Відправити' : 'Зберегти .xlsx'}
              </button>
            </div>
          </section>
        )}

        <div className={styles.reportContent}>
          {isReportReady ? (
            <SalesDetailed
              rows={detailedRows}
              totals={detailedTotals}
              metrics={metrics}
              format={format}
              title={reportTitle}
              reportMeta={selectedSummary}
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
