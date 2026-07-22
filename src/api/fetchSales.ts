import { apiGet } from './client';

export type Sale = {
  місяць: string;
  дата: string;
  бренд: string;
  товар: string;
  вага: number;
  кількість: number;
  сума: number;
  точка: string;
  адреса: string;
  агент: string;
  відділ: string;
  торгова_точка: string;
  джерело: string;
};

type MaybeObject = Record<string, unknown>;

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null) return 0;

  const cleaned = String(value)
    .replace(/\u00A0/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: unknown): string {
  if (value == null) return '';

  return String(value)
    .replace(/\u00A0/g, ' ')
    .trim();
}

function normalizeFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => cleanText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getFirstPresent(source: MaybeObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key];
  }

  return undefined;
}

function resolveStore(raw: MaybeObject): string {
  const explicitStore = cleanText(getFirstPresent(raw, ['торгова_точка']));

  if (explicitStore) return explicitStore;

  const point = cleanText(
    getFirstPresent(raw, ['точка', 'Точка', 'outlet_name'])
  );

  const address = cleanText(
    getFirstPresent(raw, ['адреса', 'Факт. адрес', 'факт. адрес', 'address'])
  );

  if (!point) return '';

  return address ? `${point} (${address})` : point;
}

function normalizeSale(raw: MaybeObject): Sale {
  const point = cleanText(
    getFirstPresent(raw, ['точка', 'Точка', 'outlet_name'])
  );

  const address = cleanText(
    getFirstPresent(raw, ['адреса', 'Факт. адрес', 'факт. адрес', 'address'])
  );

  const agent = cleanText(
    getFirstPresent(raw, ['агент', 'Агент', 'agent_name'])
  );

  return {
    місяць: cleanText(getFirstPresent(raw, ['місяць', 'Месяц', 'month'])),

    дата: cleanText(getFirstPresent(raw, ['дата', 'Дата', 'sale_date'])),

    бренд: cleanText(getFirstPresent(raw, ['бренд', 'ТМ', 'tm'])),

    товар: cleanText(getFirstPresent(raw, ['товар', 'Товар', 'product_name'])),

    вага: toNumber(getFirstPresent(raw, ['вага', 'Вес', 'weight'])),

    кількість: toNumber(getFirstPresent(raw, ['кількість', 'Кво', 'qty'])),

    сума: toNumber(getFirstPresent(raw, ['сума', 'Сумма', 'amount'])),

    точка: point,

    адреса: address,

    агент: agent,

    відділ: cleanText(getFirstPresent(raw, ['department'])),

    торгова_точка: resolveStore(raw),

    джерело: cleanText(getFirstPresent(raw, ['джерело', 'source'])) || 'main',
  };
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') return [];

  const objectPayload = payload as Record<string, unknown>;

  for (const key of ['data', 'result', 'rows', 'items']) {
    const candidate = objectPayload[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

type SalesResponse = {
  success?: boolean;
  data?: unknown;
};

export interface SalesFilters {
  search?: string;

  department?: string[];
  agent?: string[];

  stores?: string[];
  brands?: string[];
  products?: string[];

  dateFrom?: string;
  dateTo?: string;

  page?: number;
  limit?: number;

  storeSearch?: string;
  productSearch?: string;
}

function isSalesFilters(value: unknown): value is SalesFilters {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendJoinedValues(
  query: Record<string, string | number>,
  key: string,
  values: unknown
) {
  const normalizedValues = normalizeFilterValues(values);

  if (normalizedValues.length) {
    query[key] = normalizedValues.join(',');
  }
}

export async function fetchSales(filtersInput: unknown = {}): Promise<Sale[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};
  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);

  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  if (filters.search) query.search = filters.search;

  const payload = await apiGet<SalesResponse>('/api/sales', {
    authenticated: true,
    query,
  });

  const rows = extractRows(payload.data ?? payload);

  return rows
    .filter(
      (row): row is MaybeObject => typeof row === 'object' && row !== null
    )
    .map(normalizeSale)
    .filter(sale => sale.дата);
}
export interface SalesSummaryRow {
  tm: string;
  stores: number;
  weight: number;
  amount: number;
}

export interface SalesSummaryResponse {
  data: SalesSummaryRow[];
  totals: {
    stores: number;
    weight: number;
    amount: number;
  };
}
export async function fetchSalesSummary(
  filtersInput: unknown = {}
): Promise<SalesSummaryResponse> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  if (filters.search) query.search = filters.search;
  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesSummaryRow[];
    totals: {
      stores: number | string;
      weight: number | string;
      amount: number | string;
    };
  }>('/api/sales/summary', {
    authenticated: true,
    query,
  });

  return {
    data: payload.data.map(item => ({
      ...item,
      stores: Number(item.stores),
      weight: Number(item.weight),
      amount: Number(item.amount),
    })),
    totals: {
      stores: Number(payload.totals.stores),
      weight: Number(payload.totals.weight),
      amount: Number(payload.totals.amount),
    },
  };
}
export interface SalesStoreRow {
  name: string;
  sum: number;
  quantity: number;
  weight: number;
  sku: number;
}

export async function fetchSalesStores(
  filtersInput: unknown = {}
): Promise<SalesStoreRow[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesStoreRow[];
  }>('/api/sales/stores', {
    authenticated: true,
    query,
  });

  return payload.data.map(item => ({
    ...item,
    sum: Number(item.sum),
    quantity: Number(item.quantity),
    weight: Number(item.weight),
    sku: Number(item.sku),
  }));
}
export interface SalesProductRow {
  name: string;
  quantity: number;
  amount: number;
}
export async function fetchSalesProducts(
  filtersInput: unknown = {}
): Promise<SalesProductRow[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesProductRow[];
  }>('/api/sales/products', {
    authenticated: true,
    query,
  });

  return payload.data.map(item => ({
    ...item,
    quantity: Number(item.quantity),
    amount: Number(item.amount),
  }));
}

export interface SalesDateRow {
  store_name: string;
  sale_date: string;
  sum: number;
  quantity: number;
  weight: number;
  sku: number;
}
export async function fetchSalesDates(
  filtersInput: unknown = {}
): Promise<SalesDateRow[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesDateRow[];
  }>('/api/sales/dates', {
    authenticated: true,
    query,
  });

  return payload.data.map(item => ({
    ...item,
    sum: Number(item.sum),
    quantity: Number(item.quantity),
    weight: Number(item.weight),
    sku: Number(item.sku),
  }));
}
export async function fetchSalesHierarchy(
  filtersInput: unknown = {}
): Promise<unknown[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'stores', filters.stores);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: unknown[];
  }>('/api/sales/hierarchy', {
    authenticated: true,
    query,
  });

  return payload.data;
}
export type SalesFiltersResponse = {
  departments: string[];
  agents: string[];
  agentsByDepartment?: Record<string, string[]>;
  brands?: string[];
  stores?: string[];
  products?: string[];
};

export const fetchSalesFilters = async (
  filtersInput: unknown = {}
): Promise<SalesFiltersResponse> => {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'department', filters.department);
  appendJoinedValues(query, 'agent', filters.agent);

  appendJoinedValues(query, 'stores', filters.stores);

  appendJoinedValues(query, 'brands', filters.brands);

  appendJoinedValues(query, 'products', filters.products);
  if (filters.productSearch) {
    query.productSearch = filters.productSearch;
  }
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  return apiGet<SalesFiltersResponse>('/api/sales/filters', {
    authenticated: true,
    query,
  });
};
