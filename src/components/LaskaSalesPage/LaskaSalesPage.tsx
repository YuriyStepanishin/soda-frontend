import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchLaskaFilters,
  fetchLaskaHierarchy,
  fetchLaskaSales,
  fetchLaskaSummary,
  type LaskaSale,
} from '../../api/fetchLaskaSales';
import type { SummaryResponse } from '../../types/sales';
import { useSalesFilters } from '../../hooks/useSalesFilters';
import SalesFilters from '../SalesFilters/SalesFilters';
import SalesDetailed from '../SalesDetailed/SalesDetailed';
import LaskaHierarchyTable from '../LaskaHierarchyTable/LaskaHierarchyTable';
import styles from '../SalesPage/SalesPage.module.css';

type Props = { onBack: () => void };

const unique = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'uk-UA')
  );

function summarize(rows: LaskaSale[]): SummaryResponse {
  const groups = new Map<string, SummaryResponse['data'][number]>();
  const stores = new Set<string>();

  rows.forEach(row => {
    const group = row.group || 'Без групи';
    const key = `${group}::${row.tm || 'Без ТМ'}`;
    const item = groups.get(key) ?? {
      tm: row.tm || 'Без ТМ',
      group,
      quantity: 0,
      stores: 0,
      weight: 0,
      amount: 0,
      sku: 0,
    };
    item.quantity = (item.quantity ?? 0) + row.quantity;
    item.weight += row.weight;
    item.amount += row.amount;
    item.sku = (item.sku ?? 0) + 1;
    groups.set(key, item);
    if (row.store) stores.add(row.store);
  });

  return {
    data: Array.from(groups.values()).sort((a, b) => b.amount - a.amount),
    totals: {
      quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      stores: stores.size,
      weight: rows.reduce((sum, row) => sum + row.weight, 0),
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      sku: rows.length,
    },
  };
}

export default function LaskaSalesPage({ onBack }: Props) {
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
  const laskaQueryFilters = {
    dateFrom: backendFilters.dateFrom || undefined,
    dateTo: backendFilters.dateTo || undefined,
    ta: backendFilters.agent[0],
    department: backendFilters.department[0],
    tm: backendFilters.brands[0],
    store: backendFilters.stores[0],
    product: backendFilters.products[0],
  };
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['laska-sales', backendFilters],
    queryFn: () => fetchLaskaSales(laskaQueryFilters),
    enabled:
      options.showByStore || options.showByDepartment || options.showByAgent,
    staleTime: 60_000,
  });
  const summaryQuery = useQuery({
    queryKey: ['laska-sales-summary', backendFilters],
    queryFn: () => fetchLaskaSummary(laskaQueryFilters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const filtersQuery = useQuery({
    queryKey: [
      'laska-sales-filters',
      backendFilters.dateFrom,
      backendFilters.dateTo,
    ],
    queryFn: () =>
      fetchLaskaFilters({
        dateFrom: backendFilters.dateFrom || undefined,
        dateTo: backendFilters.dateTo || undefined,
      }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const hierarchyQuery = useQuery({
    queryKey: ['laska-sales-hierarchy', backendFilters],
    queryFn: () => fetchLaskaHierarchy(laskaQueryFilters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(
    () =>
      data.filter(
        row =>
          (!filters.stores.length || filters.stores.includes(row.store)) &&
          (!filters.products.length || filters.products.includes(row.product))
      ),
    [data, filters.products, filters.stores]
  );
  const summaryData = summaryQuery.data ?? summarize(rows);
  const filterOptions = filtersQuery.data ?? {
    departments: unique(data.map(row => row.department)),
    agents: unique(data.map(row => row.ta)),
    stores: unique(data.map(row => row.store)),
    brands: unique(data.map(row => row.tm)),
    groups: unique(data.map(row => row.group)),
    subgroups: [],
    products: unique(data.map(row => row.product)),
  };
  const detailedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        quantity: number;
        weight: number;
        amount: number;
        sku: number;
        stores: Set<string>;
      }
    >();
    rows.forEach(row => {
      const key =
        (options.showByStore
          ? row.store
          : options.showByDepartment
            ? row.department
            : row.ta) || 'Без назви';
      const item = map.get(key) ?? {
        quantity: 0,
        weight: 0,
        amount: 0,
        sku: 0,
        stores: new Set<string>(),
      };
      item.quantity += row.quantity;
      item.weight += row.weight;
      item.amount += row.amount;
      item.sku += 1;
      item.stores.add(row.store);
      map.set(key, item);
    });
    return Array.from(map, ([label, item]) => ({
      ...item,
      id: label,
      label,
      stores: item.stores.size,
    }));
  }, [options.showByDepartment, options.showByStore, rows]);
  const format = (value: number) =>
    new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value);

  return (
    <div className={styles.container}>
      <div className={styles.desktopLayout}>
        <SalesFilters
          filters={filters}
          updateFilters={updateFilters}
          departments={filterOptions.departments}
          agents={filterOptions.agents}
          stores={filterOptions.stores}
          brands={filterOptions.brands}
          groups={filterOptions.groups}
          subgroups={filterOptions.subgroups}
          products={filterOptions.products}
          isLaska
          showDepartment
          showAgent
          representativeLabel="LASKA"
          options={options}
          metrics={metrics}
          onChangeOptions={setOptions}
          onChangeMetrics={setMetrics}
          onSaveExcel={() => undefined}
          onApplyFilters={applyFilters}
          onOpenSalesByDays={() => undefined}
          isMobile={false}
        />
        <div>
          {summaryQuery.isLoading ||
          hierarchyQuery.isLoading ||
          (isLoading &&
            (options.showByStore ||
              options.showByDepartment ||
              options.showByAgent)) ? (
            <p>Завантаження LASKA...</p>
          ) : null}
          {summaryQuery.isError || hierarchyQuery.isError || isError ? (
            <p>Не вдалося завантажити дані LASKA.</p>
          ) : null}
          {!summaryQuery.isLoading &&
          !summaryQuery.isError &&
          !hierarchyQuery.isLoading &&
          !hierarchyQuery.isError ? (
            <>
              <LaskaHierarchyTable
                rows={hierarchyQuery.data ?? []}
                format={format}
              />
              {options.showByStore ||
              options.showByDepartment ||
              options.showByAgent ? (
                <SalesDetailed
                  rows={detailedRows}
                  totals={{
                    id: 'total',
                    label: 'Разом',
                    ...summaryData.totals,
                    quantity: summaryData.totals.quantity ?? 0,
                    sku: summaryData.totals.sku ?? 0,
                  }}
                  metrics={metrics}
                  format={format}
                  title={
                    options.showByStore
                      ? 'Деталізація по торговим точкам'
                      : options.showByDepartment
                        ? 'Деталізація по відділам'
                        : 'Деталізація по торговим представникам'
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={onBack} className={styles.button}>
        ← Назад
      </button>
    </div>
  );
}
