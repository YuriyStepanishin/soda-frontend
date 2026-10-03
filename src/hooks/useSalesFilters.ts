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
  const emptyFilters: SalesFiltersState = {
    department: [],
    agent: [],

    stores: [],
    brands: [],
    products: [],

    dateFrom: '',
    dateTo: '',
  };
  const [filters, setFilters] = useState<SalesFiltersState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<SalesFiltersState>(emptyFilters);

  const [options, setOptions] = useState({
    showDates: false,
    showProducts: false,
    showPrice: false,
    showByStore: false,
    showByDepartment: false,
    showByAgent: false,
  });

  const backendFilters = useMemo(
    () => ({
      ...appliedFilters,
      page: 1,
      limit: 5000,
    }),
    [appliedFilters]
  );

  const updateFilters = (values: Partial<SalesFiltersState>) => {
    setFilters(prev => ({
      ...prev,
      ...values,
    }));
  };

  const applyFilters = () => setAppliedFilters(filters);

  return {
    filters,
    updateFilters,
    applyFilters,

    backendFilters,

    options,
    setOptions,
  };
}
