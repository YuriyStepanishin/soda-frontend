import { apiGet } from './client';
import type { SummaryResponse } from '../types/sales';

export type LaskaSale = {
  id: string | number;
  date: string;
  ta: string;
  storeCode: string;
  store: string;
  productCode: string;
  product: string;
  quantity: number;
  amount: number;
  price: number;
  invoice: string;
  address: string;
  purchasePrice: number;
  weight: number;
  manufacturer: string;
  tm: string;
  group: string;
  subgroup: string;
  department: string;
  route: string;
};

export type LaskaSalesFilters = {
  dateFrom?: string;
  dateTo?: string;
  ta?: string;
  department?: string;
  route?: string;
  storeCode?: string;
  store?: string;
  product?: string;
  manufacturer?: string;
  tm?: string;
  group?: string;
  subgroup?: string;
};

type RawRow = Record<string, unknown>;

const text = (value: unknown) => (value == null ? '' : String(value).trim());

const number = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapRow = (row: RawRow): LaskaSale => ({
  id: text(row.id),
  date: text(row['Дата']),
  ta: text(row['ТА']),
  storeCode: text(row['Код ТТ']),
  store: text(row['ТТ']),
  productCode: text(row['Код товара']),
  product: text(row['Наименование товара']),
  quantity: number(row['Шт']),
  amount: number(row['Сумма']),
  price: number(row['Цена']),
  invoice: text(row['Номер накладной']),
  address: text(row['Адрес']),
  purchasePrice: number(row['Цена закупки']),
  weight: number(row['Вес']),
  manufacturer: text(row['Виробник']),
  tm: text(row['ТМ']),
  group: text(row['Група']),
  subgroup: text(row['Підгрупа']),
  department: text(row['Відділ']),
  route: text(row['Маршрут']),
});

export async function fetchLaskaSales(
  filters: LaskaSalesFilters = {}
): Promise<LaskaSale[]> {
  const query: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value) query[key] = value;
  }

  const payload = await apiGet<{ data?: RawRow[] }>('/api/laska/sales', {
    authenticated: true,
    query,
  });

  return (payload.data ?? []).map(mapRow);
}

function buildQuery(filters: LaskaSalesFilters) {
  const query: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) query[key] = value;
  }
  return query;
}

export async function fetchLaskaSummary(
  filters: LaskaSalesFilters = {}
): Promise<SummaryResponse> {
  const payload = await apiGet<{
    data: SummaryResponse['data'];
    totals: SummaryResponse['totals'];
  }>('/api/laska/sales/summary', {
    authenticated: true,
    query: buildQuery(filters),
  });

  return {
    data: payload.data.map(row => ({
      ...row,
      quantity: Number(row.quantity ?? 0),
      stores: Number(row.stores ?? 0),
      weight: Number(row.weight ?? 0),
      amount: Number(row.amount ?? 0),
      sku: Number(row.sku ?? 0),
    })),
    totals: {
      quantity: Number(payload.totals.quantity ?? 0),
      stores: Number(payload.totals.stores ?? 0),
      weight: Number(payload.totals.weight ?? 0),
      amount: Number(payload.totals.amount ?? 0),
      sku: Number(payload.totals.sku ?? 0),
    },
  };
}

export type LaskaFiltersResponse = {
  departments: string[];
  agents: string[];
  stores: string[];
  brands: string[];
  products: string[];
};

export async function fetchLaskaFilters(
  filters: LaskaSalesFilters = {}
): Promise<LaskaFiltersResponse> {
  return apiGet<LaskaFiltersResponse>('/api/laska/sales/filters', {
    authenticated: true,
    query: buildQuery(filters),
  });
}


export type LaskaHierarchyRow = {
  group: string;
  subgroup: string;
  tm: string;
  quantity: number;
  weight: number;
  amount: number;
  sku: number;
  stores: number;
};

export async function fetchLaskaHierarchy(
  filters: LaskaSalesFilters = {}
): Promise<LaskaHierarchyRow[]> {
  const payload = await apiGet<{ data: LaskaHierarchyRow[] }>(
    '/api/laska/sales/hierarchy',
    { authenticated: true, query: buildQuery(filters) }
  );

  return payload.data.map(row => ({
    ...row,
    quantity: Number(row.quantity ?? 0),
    weight: Number(row.weight ?? 0),
    amount: Number(row.amount ?? 0),
    sku: Number(row.sku ?? 0),
    stores: Number(row.stores ?? 0),
  }));
}
