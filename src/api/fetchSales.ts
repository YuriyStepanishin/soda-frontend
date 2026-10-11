import { apiGet } from './client';

export type Sale = {
  місяць: string;
  дата: string;
  бренд: string;
  група?: string;
  підгрупа?: string;
  фасовка?: string;
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

  // Normalize locale-formatted numbers like "1 234,56" before Number().
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
    // Accept already-split multi-select filters.
    return value.map(item => cleanText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    // Also support comma-separated values from persisted/query state.
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getFirstPresent(source: MaybeObject, keys: string[]): unknown {
  // Backend may return different field aliases; pick the first existing key.
  for (const key of keys) {
    if (key in source) return source[key];
  }

  return undefined;
}

function resolveStore(raw: MaybeObject): string {
  const explicitStore = cleanText(getFirstPresent(raw, ['торгова_точка']));

  if (explicitStore) return explicitStore;

  const point = cleanText(
    getFirstPresent(raw, ['точка', 'Точка', 'outlet_name', 'ТТ'])
  );

  const address = cleanText(
    getFirstPresent(raw, [
      'адреса',
      'Адреса',
      'Адрес',
      'Факт. адрес',
      'факт. адрес',
      'address',
    ])
  );

  if (!point) return '';

  // Fallback display: "Point (Address)" when canonical store name is absent.
  return address ? `${point} (${address})` : point;
}

function normalizeSale(raw: MaybeObject): Sale {
  const point = cleanText(
    getFirstPresent(raw, ['точка', 'Точка', 'outlet_name', 'ТТ'])
  );

  const address = cleanText(
    getFirstPresent(raw, [
      'адреса',
      'Адреса',
      'Адрес',
      'Факт. адрес',
      'факт. адрес',
      'address',
    ])
  );

  const agent = cleanText(
    getFirstPresent(raw, ['агент', 'Агент', 'agent_name', 'ТА'])
  );

  return {
    // Each field maps backend aliases to one stable frontend contract.
    місяць: cleanText(getFirstPresent(raw, ['місяць', 'Месяц', 'month'])),

    дата: cleanText(getFirstPresent(raw, ['дата', 'Дата', 'sale_date'])),

    бренд: cleanText(getFirstPresent(raw, ['бренд', 'ТМ', 'tm'])),

    група: cleanText(
      getFirstPresent(raw, ['група', 'Група', 'группа', 'Группа', 'group'])
    ),

    підгрупа: cleanText(
      getFirstPresent(raw, [
        'підгрупа',
        'Підгрупа',
        'подгруппа',
        'Подгруппа',
        'subgroup',
      ])
    ),

    фасовка:
      cleanText(getFirstPresent(raw, ['фасовка', 'Фасовка', 'packing'])) ||
      cleanText(getFirstPresent(raw, ['вага', 'Вес', 'weight'])),

    товар: cleanText(getFirstPresent(raw, ['товар', 'Товар', 'product_name'])),

    вага: toNumber(getFirstPresent(raw, ['вага', 'Вес', 'weight'])),

    кількість: toNumber(getFirstPresent(raw, ['кількість', 'Кво', 'qty'])),

    сума: toNumber(getFirstPresent(raw, ['сума', 'Сумма', 'amount'])),

    точка: point,

    адреса: address,

    агент: agent,

    відділ: cleanText(getFirstPresent(raw, ['department', 'Відділ'])),

    торгова_точка: resolveStore(raw),

    джерело: cleanText(getFirstPresent(raw, ['джерело', 'source'])) || 'main',
  };
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== 'object') return [];

  const objectPayload = payload as Record<string, unknown>;

  // Support common wrappers used by different backend handlers.
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
  groups?: string[];
  subgroups?: string[];
  packings?: string[];
  products?: string[];

  dateFrom?: string;
  dateTo?: string;

  groupingFields?: string;

  page?: number;
  limit?: number;

  storeSearch?: string;
  productSearch?: string;
}

function isSalesFilters(value: unknown): value is SalesFilters {
  // Runtime guard for untyped inputs from URL/state storage.
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendJoinedValues(
  query: Record<string, string | number>,
  key: string,
  values: unknown
) {
  // Backend expects list filters as comma-separated string values.
  const normalizedValues = normalizeFilterValues(values);

  if (normalizedValues.length) {
    query[key] = normalizedValues.join(',');
  }
}

export async function fetchSales(filtersInput: unknown = {}): Promise<Sale[]> {
  // Detailed rows endpoint used for agent/department aggregation in UI.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};
  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);

  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  if (filters.groupingFields) query.groupingFields = filters.groupingFields;

  if (filters.search) query.search = filters.search;

  const payload = await apiGet<SalesResponse>('/api/sales', {
    authenticated: true,
    query,
  });

  const rows = extractRows(payload.data ?? payload);

  // Keep only valid records with a date to avoid empty/technical rows in UI.
  return rows
    .filter(
      (row): row is MaybeObject => typeof row === 'object' && row !== null
    )
    .map(normalizeSale)
    .filter(sale => sale.дата);
}
export interface SalesSummaryRow {
  tm: string;
  quantity?: number;
  stores: number;
  weight: number;
  amount: number;
  sku?: number;
}

export interface SalesSummaryResponse {
  data: SalesSummaryRow[];
  totals: {
    quantity?: number;
    stores: number;
    weight: number;
    amount: number;
    sku?: number;
  };
}
export async function fetchSalesSummary(
  filtersInput: unknown = {}
): Promise<SalesSummaryResponse> {
  // Summary endpoint used by brand-level totals table.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  if (filters.search) query.search = filters.search;
  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  if (filters.storeSearch) query.storeSearch = filters.storeSearch;

  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesSummaryRow[];
    totals: {
      quantity?: number | string;
      stores: number | string;
      weight: number | string;
      amount: number | string;
      sku?: number | string;
    };
  }>('/api/sales/summary', {
    authenticated: true,
    query,
  });

  return {
    // Normalize numeric fields because backend may send strings.
    data: payload.data.map(item => ({
      ...item,
      quantity: Number(item.quantity ?? 0),
      stores: Number(item.stores),
      weight: Number(item.weight),
      amount: Number(item.amount),
      sku: Number(item.sku ?? 0),
    })),
    totals: {
      quantity: Number(payload.totals.quantity ?? 0),
      stores: Number(payload.totals.stores),
      weight: Number(payload.totals.weight),
      amount: Number(payload.totals.amount),
      sku: Number(payload.totals.sku ?? 0),
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
  // Store-level aggregation endpoint.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
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

  // Force numeric types for table math and totals.
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
  // Product-level aggregation endpoint.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
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

  // Force numeric types for table math and totals.
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

export type SalesReportBy = string;

export interface SalesReportRow {
  id: string;
  label: string;
  path?: string;
  level?: number;
  dimensions?: Record<string, string>;
  quantity: number;
  stores: number;
  weight: number;
  amount: number;
  sku: number;
}

export interface SalesReportResponse {
  reportBy: SalesReportBy;
  rows: SalesReportRow[];
  totals: SalesReportRow;
}

export async function fetchSalesReport(
  filtersInput: unknown = {}
): Promise<SalesReportResponse> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};
  const reportBy =
    typeof (filtersInput as { reportBy?: unknown })?.reportBy === 'string'
      ? ((filtersInput as { reportBy: SalesReportBy }).reportBy)
      : 'brand';

  const query: Record<string, string | number> = { reportBy };

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);

  if (filters.storeSearch) query.storeSearch = filters.storeSearch;
  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;
  if (filters.search) query.search = filters.search;

  const payload = await apiGet<{
    success: boolean;
    reportBy: SalesReportBy;
    rows: SalesReportRow[];
    totals: SalesReportRow;
  }>('/api/sales/report', {
    authenticated: true,
    query,
  });

  const normalizeRow = (row: SalesReportRow): SalesReportRow => ({
    ...row,
    quantity: Number(row.quantity ?? 0),
    stores: Number(row.stores ?? 0),
    weight: Number(row.weight ?? 0),
    amount: Number(row.amount ?? 0),
    sku: Number(row.sku ?? 0),
  });

  return {
    reportBy: payload.reportBy,
    rows: payload.rows.map(normalizeRow),
    totals: normalizeRow(payload.totals),
  };
}

export async function fetchSalesDates(
  filtersInput: unknown = {}
): Promise<SalesDateRow[]> {
  // Date-level aggregation endpoint.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
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

  // Force numeric types for table math and totals.
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
  // Raw hierarchy endpoint (shape is backend-defined, consumed by specialized UI).
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'products', filters.products);
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
  groups?: string[];
  subgroups?: string[];
  packings?: string[];
  stores?: string[];
  products?: string[];
};

export const fetchSalesFilters = async (
  filtersInput: unknown = {}
): Promise<SalesFiltersResponse> => {
  // Returns dynamic filter dictionaries based on already selected constraints.
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'department', filters.department);
  appendJoinedValues(query, 'agent', filters.agent);

  appendJoinedValues(query, 'stores', filters.stores);

  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);

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
export interface SalesByDaysRow {
  date: string;
  week_year: number;
  week_number: number;
  amount: number;
  weight: number;
  storesCount: number;
  tt500: number;
}

export async function fetchSalesByDays(
  filtersInput: unknown = {}
): Promise<SalesByDaysRow[]> {
  const filters = isSalesFilters(filtersInput) ? filtersInput : {};

  const query: Record<string, string | number> = {};

  appendJoinedValues(query, 'agent', filters.agent);
  appendJoinedValues(query, 'department', filters.department);
  appendJoinedValues(query, 'stores', filters.stores);
  appendJoinedValues(query, 'brands', filters.brands);
  appendJoinedValues(query, 'groups', filters.groups);
  appendJoinedValues(query, 'subgroups', filters.subgroups);
  appendJoinedValues(query, 'packings', filters.packings);
  appendJoinedValues(query, 'products', filters.products);

  if (filters.dateFrom) query.dateFrom = filters.dateFrom;
  if (filters.dateTo) query.dateTo = filters.dateTo;

  const payload = await apiGet<{
    success: boolean;
    data: SalesByDaysRow[];
  }>('/api/sales/by-days', {
    authenticated: true,
    query,
  });

  return payload.data.map(item => ({
    ...item,
    amount: Number(item.amount),
    weight: Number(item.weight),
    storesCount: Number(item.storesCount),
    tt500: Number(item.tt500),
    week_year: Number(item.week_year),
    week_number: Number(item.week_number),
  }));
}
