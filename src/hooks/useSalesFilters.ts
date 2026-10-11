import { useMemo, useState } from 'react';

export interface SalesFiltersState {
  department: string[];
  agent: string[];

  stores: string[];
  brands: string[];
  groups: string[];
  subgroups: string[];
  packings: string[];
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
    groups: [],
    subgroups: [],
    packings: [],
    products: [],

    dateFrom: '',
    dateTo: '',
  };
  const [filters, setFilters] = useState<SalesFiltersState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<SalesFiltersState>(emptyFilters);

  const [options, setOptions] = useState({
    showGroups: false,
    showSubgroups: false,
    showBrands: true,
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
