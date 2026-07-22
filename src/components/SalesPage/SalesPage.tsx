import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { exportSalesToExcel } from '../../utils/exportSalesToExcel';
import {
  fetchSales,
  fetchSalesSummary,
  fetchSalesFilters,
} from '../../api/fetchSales';
import { queryKeys } from '../../api/queryKeys';
import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import styles from './SalesPage.module.css';
import SalesFilters from '../SalesFilters/SalesFilters';
import SalesTable from '../SalesTable/SalesTable';
import { useSalesFilters } from '../../hooks/useSalesFilters';

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

  const { filters, updateFilters, backendFilters, options, setOptions } =
    useSalesFilters();

  const [metrics, setMetrics] = useState({
    quantity: true,
    weight: true,
    amount: true,
    sku: true,
    price: false,
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

  const isValidPeriod =
    !filters.dateFrom || !filters.dateTo || filters.dateFrom <= filters.dateTo;

  const { data: summaryData } = useQuery({
    queryKey: [queryKeys.sales, 'summary', backendFilters],
    queryFn: () => fetchSalesSummary(backendFilters),
    staleTime: 1000 * 60 * 5,
    enabled: isValidPeriod,
    placeholderData: keepPreviousData,
  });

  const { data: filtersData } = useQuery({
    queryKey: ['sales-filters', backendFilters],
    queryFn: () => fetchSalesFilters(backendFilters),
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
      amount: summaryData?.totals.amount ?? 0,
      weight: summaryData?.totals.weight ?? 0,
      stores: summaryData?.totals.stores ?? 0,
    }),
    [summaryData]
  );

  const format = (n: number) => numberFormatter.format(n);

  const activeColumns = useMemo(() => {
    const columns: Array<{
      key: 'stores' | 'weight' | 'amount';
      label: string;
    }> = [];

    if (metrics.sku) {
      columns.push({ key: 'stores', label: 'ТТ' });
    }

    if (metrics.weight) {
      columns.push({ key: 'weight', label: 'Вага' });
    }

    if (metrics.amount) {
      columns.push({ key: 'amount', label: 'Сума' });
    }

    if (columns.length === 0) {
      columns.push({ key: 'amount', label: 'Сума' });
    }

    return columns;
  }, [metrics.sku, metrics.weight, metrics.amount]);

  const handleSaveExcel = async () => {
    const sales = await fetchSales({
      ...backendFilters,
      page: 1,
      limit: 50000,
    });

    await exportSalesToExcel({
      sales,
      summary: summaryData?.data ?? [],
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
          onOpenSalesByDays={onOpenSalesByDays}
          isMobile={isMobile}
        />
        <SalesTable
          summaryData={summaryData}
          activeColumns={activeColumns}
          format={format}
        />
      </div>

      <button onClick={onBack} className={styles.button}>
        ← Назад
      </button>
    </div>
  );
}
