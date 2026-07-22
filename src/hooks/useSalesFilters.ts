import { useMemo, useState } from 'react';

export interface SalesFiltersState {
  department: string[];
  agent: string[];

  stores: string[];
  brands: string[];
  products: string[];

  dateFrom: string;
  dateTo: string;
}

export function useSalesFilters() {
  const [filters, setFilters] = useState<SalesFiltersState>({
    department: [],
    agent: [],

    stores: [],
    brands: [],
    products: [],

    dateFrom: '',
    dateTo: '',
  });

  const [options, setOptions] = useState({
    showDates: false,
    showProducts: false,
  });

  const backendFilters = useMemo(
    () => ({
      ...filters,
      page: 1,
      limit: 5000,
    }),
    [filters]
  );

  const updateFilters = (values: Partial<SalesFiltersState>) => {
    setFilters(prev => ({
      ...prev,
      ...values,
    }));
  };

  return {
    filters,
    updateFilters,

    backendFilters,

    options,
    setOptions,
  };
}
