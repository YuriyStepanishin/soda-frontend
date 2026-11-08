import { useMemo, useState } from 'react';
import { readSalesSettings } from '../api/salesOffline';

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
  const [saved] = useState(() => readSalesSettings<{ filters: SalesFiltersState; options: Record<string, boolean> }>('sales'));
  const initialFilters = { ...emptyFilters };
  for (const field of Object.keys(emptyFilters) as (keyof SalesFiltersState)[]) {
    const value = saved?.filters?.[field];
    if (field === 'dateFrom' || field === 'dateTo') {
      if (typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})?$/.test(value)) initialFilters[field] = value;
    } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) initialFilters[field] = value;
  }
  const [filters, setFilters] = useState<SalesFiltersState>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<SalesFiltersState>(initialFilters);

  const [options, setOptions] = useState(() => {
    const defaults = {
    showGroups: false,
    showSubgroups: false,
    showBrands: true,
    showDates: false,
    showProducts: false,
    showPrice: false,
    showByStore: false,
    showByDepartment: false,
    showByAgent: false,
    };
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      if (typeof saved?.options?.[key] === 'boolean') defaults[key] = saved.options[key];
    }
    return defaults;
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

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  return {
    filters,
    updateFilters,
    applyFilters,

    backendFilters,

    options,
    setOptions,
  };
}
