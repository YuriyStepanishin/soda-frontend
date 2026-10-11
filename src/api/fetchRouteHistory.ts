import { apiGet } from './client';

export type RouteHistoryPeriod = {
  key: string;
  label: string;
};

export type RouteHistoryProduct = {
  name: string;
  values: number[];
};

export type RouteHistoryBrand = {
  label: string;
  products: RouteHistoryProduct[];
  totals: number[];
  isEmpty: boolean;
};

export type RouteHistoryStore = {
  store: string;
  brands: RouteHistoryBrand[];
  totals: number[];
  hasHistory: boolean;
};

export type RouteHistoryResponse = {
  periods: RouteHistoryPeriod[];

  summary: {
    allStores: number;
    withoutHistory: number;
  };

  filters: {
    departments: string[];
    agents: string[];
    route?: string;
  };

  stores: RouteHistoryStore[];
};

type RouteHistoryParams = {
  period: '4weeks' | '4months';
  asOfDate?: string;
  ta?: string;
  storeSearch?: string;
  department?: string;
  groupingFields: string;
};

export async function fetchRouteHistory(
  params: RouteHistoryParams,
  signal?: AbortSignal
): Promise<RouteHistoryResponse> {
  const searchParams = new URLSearchParams();

  searchParams.set('period', params.period);

  if (params.asOfDate) {
    searchParams.set('asOfDate', params.asOfDate);
  }

  if (params.ta) {
    searchParams.set('ta', params.ta);
  }

  if (params.storeSearch) {
    searchParams.set('storeSearch', params.storeSearch);
  }

  if (params.department) {
    searchParams.set('department', params.department);
  }

  searchParams.set('groupingFields', params.groupingFields);

  const payload = await apiGet<RawRouteHistoryResponse>(
    `/api/sales/route-history?${searchParams.toString()}`,
    { authenticated: true, signal }
  );

  return mapRouteHistory(payload, params);
}

type RawRouteHistoryResponse = {
  success: boolean;
  periods: Array<{
    key: string;
    label?: string;
    year?: number;
    periodNumber?: number;
  }>;
  summary: RouteHistoryResponse['summary'];
  filters: RouteHistoryResponse['filters'];
  stores: Array<{
    code?: string;
    name: string;
    hasHistory: boolean;
    items: Array<{
      group?: string;
      subgroup?: string;
      tm?: string;
      packing?: string;
      product?: string;
      productCode?: string | null;
      startDate: string;
      quantity: number;
      periods?: Record<string, { quantity: number }>;
    }>;
  }>;
};

const GROUPING_FALLBACK_LABELS: Record<string, string> = {
  group: 'Без групи',
  subgroup: 'Без підгрупи',
  tm: 'Без ТМ',
  packing: 'Без фасовки',
};

function normalizeText(value: string | undefined): string {
  return (
    value
      ?.replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function getIsoWeekNumber(dateKey: string): number {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatMonthPeriod(dateKey: string): string {
  const [year, month] = dateKey.split('-');

  return `${month}.${year}`;
}

function mapRouteHistory(
  data: RawRouteHistoryResponse,
  params: RouteHistoryParams
): RouteHistoryResponse {
  const periods = data.periods.map(period => ({
    key: period.key,
    label: period.label
      ? params.period === '4weeks'
        ? String(getIsoWeekNumber(period.key))
        : formatMonthPeriod(period.key)
      : params.period === '4months'
        ? formatMonthPeriod(period.key)
        : String(period.periodNumber ?? getIsoWeekNumber(period.key)),
  }));

  const fields = params.groupingFields.split(',').filter(Boolean);
  const sum = (target: number[], source: number[]) =>
    source.forEach((value, index) => (target[index] += value));

  const stores = data.stores.map(store => {
    const grouped = new Map<string, Map<string, number[]>>();

    store.items.forEach(item => {
      const label = fields
        .map(
          field =>
            normalizeText(
              item[field as 'group' | 'subgroup' | 'tm' | 'packing']
            ) || GROUPING_FALLBACK_LABELS[field]
        )
        .join(' / ');
      const product = normalizeText(item.product);

      if (!grouped.has(label)) grouped.set(label, new Map());
      if (!product) return;

      const products = grouped.get(label)!;
      if (!products.has(product)) {
        products.set(product, Array(periods.length).fill(0));
      }

      const values = products.get(product)!;
      periods.forEach((period, index) => {
        values[index] += Number(
          item.periods?.[period.key]?.quantity ??
            (item.startDate === period.key ? item.quantity : 0)
        );
      });
    });

    const brands: RouteHistoryBrand[] = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'uk'))
      .map(([label, productsMap]) => {
        const products = Array.from(productsMap.entries())
          .map(([name, values]) => ({ name, values }))
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
        const totals: number[] = Array(periods.length).fill(0);
        products.forEach(product => sum(totals, product.values));

        return {
          label,
          products,
          totals,
          isEmpty: totals.every(value => value === 0),
        };
      });

    const totals: number[] = Array(periods.length).fill(0);
    brands.forEach(brand => sum(totals, brand.totals));

    return {
      store: store.name,
      brands,
      totals,
      hasHistory: store.hasHistory,
    };
  });

  return { periods, summary: data.summary, filters: data.filters, stores };
}
