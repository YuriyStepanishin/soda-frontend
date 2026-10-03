import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { exportSalesToExcel } from '../../utils/exportSalesToExcel';
import {
  fetchSales,
  fetchSalesSummary,
  fetchSalesFilters,
  fetchSalesStores,
} from '../../api/fetchOlgatorgSales';
import { queryKeys } from '../../api/queryKeys';
import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import styles from './SalesPage.module.css';
import SalesFilters from '../SalesFilters/SalesFilters';
import SalesTable from '../SalesTable/SalesTable';
import SalesDetailed from '../SalesDetailed/SalesDetailed';
import { useSalesFilters } from '../../hooks/useSalesFilters';

// Sales analytics screen:
// - fetches summary/detailed data via React Query
// - applies role-aware filter defaults
// - builds table rows/totals for selected grouping mode
type SalesPageProps = {
  onBack: () => void;
  onOpenSalesByDays: () => void;
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

  const {
    filters,
    updateFilters,
    applyFilters,
    backendFilters,
    options,
    setOptions,
  } =
    useSalesFilters();

  const [metrics, setMetrics] = useState({
    quantity: true,
    weight: true,
    amount: true,
    sku: true,
    stores: true,
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 560px)').matches;
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

  const safeBackendFilters = useMemo(() => {
    const nextFilters = { ...backendFilters };

    if (hasInvalidDateRange) {
      Reflect.deleteProperty(nextFilters, 'dateFrom');
      Reflect.deleteProperty(nextFilters, 'dateTo');
    }

    return nextFilters;
  }, [backendFilters, hasInvalidDateRange]);

  const { data: summaryData } = useQuery({
    queryKey: [queryKeys.sales, 'summary', safeBackendFilters],
    queryFn: () => fetchSalesSummary(safeBackendFilters),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod,
    placeholderData: keepPreviousData,
  });

  const { data: storeData } = useQuery({
    queryKey: [queryKeys.sales, 'stores', safeBackendFilters],
    queryFn: () => fetchSalesStores(safeBackendFilters),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod && options.showByStore,
    placeholderData: keepPreviousData,
  });

  const { data: salesListData } = useQuery({
    queryKey: [queryKeys.sales, 'list', safeBackendFilters],
    queryFn: () => fetchSales(safeBackendFilters),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod && (options.showByDepartment || options.showByAgent),
    placeholderData: keepPreviousData,
  });

  const { data: filtersData } = useQuery({
    queryKey: ['sales-filters', safeBackendFilters],
    queryFn: () => fetchSalesFilters(safeBackendFilters),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 560px)');
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
    stores = [],
    products = [],
    departments = [],
    agents = [],
  } = filtersData ?? {};

  const totalRow = useMemo(
    () => ({
      quantity: summaryData?.totals.quantity ?? 0,
      stores: summaryData?.totals.stores ?? 0,
      weight: summaryData?.totals.weight ?? 0,
      amount: summaryData?.totals.amount ?? 0,
      sku: summaryData?.totals.sku ?? 0,
    }),
    [summaryData]
  );

  const detailedRows = useMemo(() => {
    if (options.showByStore) {
      return (storeData ?? []).map(item => ({
        id: item.name,
        label: item.name,
        quantity: item.quantity,
        stores: 1,
        weight: item.weight,
        amount: item.sum,
        sku: item.sku,
      }));
    }

    if (options.showByDepartment || options.showByAgent) {
      const map = new Map<
        string,
        {
          id: string;
          label: string;
          quantity: number;
          stores: Set<string>;
          weight: number;
          amount: number;
          sku: number;
        }
      >();

      for (const row of salesListData ?? []) {
        const key = options.showByDepartment ? row.відділ : row.агент;
        if (!key) continue;

        const item = map.get(key) ?? {
          id: key,
          label: key,
          quantity: 0,
          stores: new Set<string>(),
          weight: 0,
          amount: 0,
          sku: 0,
        };

        item.quantity += row.кількість;
        item.weight += row.вага;
        item.amount += row.сума;
        item.sku += 1;
        item.stores.add(row.торгова_точка || row.точка || 'Невідомо');

        map.set(key, item);
      }

      return Array.from(map.values()).map(item => ({
        id: item.id,
        label: item.label,
        quantity: item.quantity,
        stores: item.stores.size,
        weight: item.weight,
        amount: item.amount,
        sku: item.sku,
      }));
    }

    return (summaryData?.data ?? []).map(item => ({
      id: item.tm,
      label: item.tm,
      quantity: item.quantity ?? 0,
      stores: item.stores,
      weight: item.weight,
      amount: item.amount,
      sku: item.sku ?? 0,
    }));
  }, [
    options.showByAgent,
    options.showByDepartment,
    options.showByStore,
    salesListData,
    summaryData,
    storeData,
  ]);

  const detailedTotals = useMemo(() => {
    if (options.showByStore) {
      return {
        id: 'total',
        label: 'Усі ТТ',
        quantity:
          storeData?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0,
        stores: storeData?.length ?? 0,
        weight:
          storeData?.reduce((sum, item) => sum + (item.weight ?? 0), 0) ?? 0,
        amount: storeData?.reduce((sum, item) => sum + (item.sum ?? 0), 0) ?? 0,
        sku: storeData?.reduce((sum, item) => sum + (item.sku ?? 0), 0) ?? 0,
      };
    }

    if (options.showByDepartment || options.showByAgent) {
      return {
        id: 'total',
        label: options.showByDepartment ? 'Усі відділи' : 'Усі ТП',
        quantity: detailedRows.reduce((sum, item) => sum + item.quantity, 0),
        stores: detailedRows.reduce((sum, item) => sum + item.stores, 0),
        weight: detailedRows.reduce((sum, item) => sum + item.weight, 0),
        amount: detailedRows.reduce((sum, item) => sum + item.amount, 0),
        sku: detailedRows.reduce((sum, item) => sum + item.sku, 0),
      };
    }

    return {
      id: 'total',
      label: 'Усі торгові марки',
      quantity: totalRow.quantity,
      stores: totalRow.stores,
      weight: totalRow.weight,
      amount: totalRow.amount,
      sku: totalRow.sku,
    };
  }, [
    detailedRows,
    options.showByAgent,
    options.showByDepartment,
    options.showByStore,
    storeData,
    totalRow,
  ]);

  const format = (n: number) => numberFormatter.format(n);

  const activeColumns = useMemo(
    () =>
      [
        { key: 'stores', label: 'ТТ' },
        { key: 'quantity', label: 'Кількість, шт' },
        { key: 'weight', label: 'Вага' },
        { key: 'sku', label: 'SKU' },
        { key: 'amount', label: 'Сума, грн' },
      ] as Array<{
        key: 'quantity' | 'stores' | 'weight' | 'amount' | 'sku';
        label: string;
      }>,
    []
  );

  const handleSaveExcel = async () => {
    const sales = await fetchSales({
      ...backendFilters,
      page: 1,
      limit: 50000,
    });

    const brandsList = (summaryData?.data ?? []).map(item => ({
      brand: item.tm,
      stores: item.stores,
      weight: item.weight,
      amount: item.amount,
    }));

    await exportSalesToExcel({
      sales,
      brandsList,
      totalRow,
      agent: filters.agent,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      isMobile,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.desktopLayout}>
        <SalesFilters
          filters={filters}
          updateFilters={updateFilters}
          departments={departments}
          agents={agents}
          stores={stores}
          brands={brands}
          products={products}
          showDepartment={!isSupervisor && !isAgent}
          showAgent={!isAgent}
          representativeLabel={ownRepresentative}
          options={options}
          metrics={metrics}
          onChangeOptions={setOptions}
          onChangeMetrics={setMetrics}
          onSaveExcel={handleSaveExcel}
          onApplyFilters={applyFilters}
          onOpenSalesByDays={onOpenSalesByDays}
          isMobile={isMobile}
          dateError={
            hasInvalidDateRange
              ? 'Дата "від" не може бути більшою за дату "до".'
              : undefined
          }
        />
        <div>
          <SalesTable
            summaryData={summaryData}
            activeColumns={activeColumns}
            format={format}
          />

          {options.showByStore ||
          options.showByDepartment ||
          options.showByAgent ? (
            <SalesDetailed
              rows={detailedRows}
              totals={detailedTotals}
              metrics={metrics}
              format={format}
              title={
                options.showByStore
                  ? 'Деталізація по ТТ'
                  : options.showByDepartment
                    ? 'Деталізація по відділам'
                    : 'Деталізація по ТП'
              }
            />
          ) : null}
        </div>
      </div>

      <button onClick={onBack} className={styles.button}>
        ← Назад
      </button>
    </div>
  );
}
