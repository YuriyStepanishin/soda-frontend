import type { Sale } from '../../api/fetchSales';
import { canUserSeeBrand } from '../../config/userRoles';
import {
  fetchPlanColumns,
  savePlanColumnsToSheet,
} from '../../api/planTargets';
import { ORIMI_BRANDS, type BrandFilter, matchesBrand } from './agentsConfig';

export type AssortmentMode = 'all' | 'specific';
export type MetricBase = 'sum' | 'tt' | 'sku';
export type MetricUnit = 'grn' | 'kg' | 'pcs' | 'sku';
export type CalculationMode = 'period' | 'shipment';

export type MetricType =
  | 'grn' // Сума грн
  | 'kg' // Сума кг
  | 'pcs' // Сума шт
  | 'tt' // ТТ від 0
  | 'tt_from_x' // ТТ від грн (backward compat)
  | 'tt_from_kg' // ТТ від кг
  | 'tt_from_pcs' // ТТ від шт
  | 'tt_from_sku' // ТТ від SKU
  | 'checkin_sku' // Асортимент по ТМ (чекін)
  | 'total_sku' // Сумарне SKU
  | 'avg_sku'; // Середнє SKU

export interface PlanColumn {
  id: string;
  label: string;
  /** Порядковий номер колонки для відображення у таблиці виконання */
  displayOrder?: number;
  brand: BrandFilter;
  brands?: BrandFilter[];
  assortmentMode?: AssortmentMode;
  assortmentProduct?: string;
  assortmentProducts?: string[];
  metric: MetricType;
  /** Поріг для tt_from_* метрик */
  threshold: number;
  /** Метод застосування порогу: за період або разово за одне відвантаження */
  calcMode?: CalculationMode;
  /** План на агента: { 'Гриник Ольга': 65, ... } */
  agentPlans: Record<string, number>;
  /** Режим плану по відділу: 'total' — один план на відділ, 'individual' — на кожного агента */
  deptMode?: Record<string, 'total' | 'individual'>;
  /** Загальний план по відділу (використовується коли deptMode[dept] === 'total') */
  deptPlans?: Record<string, number>;
}

export type StoreFactDetail = {
  store: string;
  value: number;
};

export const BRAND_OPTIONS: { value: BrandFilter; label: string }[] = [
  { value: 'jockey', label: 'Жокей' },
  { value: 'greenfield', label: 'Greenfield' },
  { value: 'tess', label: 'TESS' },
  { value: 'jardin', label: 'JARDIN' },
  { value: 'piazza', label: 'PIAZZA' },
  { value: 'princessa_nuri', label: 'Принцеса Нурі' },
  { value: 'princessa_kandi', label: 'Принцеса Канді' },
  { value: 'princessa_yava', label: 'Принцеса Ява' },
  { value: 'princessa_gita', label: 'Принцеса Гіта' },
  { value: 'delicia', label: 'Деліція' },
];

export const ASSORTMENT_MODE_OPTIONS: {
  value: AssortmentMode;
  label: string;
}[] = [
  { value: 'all', label: 'Увесь асортимент' },
  { value: 'specific', label: 'Визначений асортимент' },
];

export const METRIC_BASE_OPTIONS: { value: MetricBase; label: string }[] = [
  { value: 'sum', label: 'Сума' },
  { value: 'tt', label: 'ТТ' },
  { value: 'sku', label: 'SKU' },
];

export const METRIC_UNIT_OPTIONS: { value: MetricUnit; label: string }[] = [
  { value: 'grn', label: 'грн' },
  { value: 'kg', label: 'кг' },
  { value: 'pcs', label: 'шт' },
  { value: 'sku', label: 'SKU' },
];

export const CALCULATION_MODE_OPTIONS: {
  value: CalculationMode;
  label: string;
}[] = [
  { value: 'period', label: 'За період' },
  { value: 'shipment', label: 'Разово за одне відвантаження' },
];

function normalizeText(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function selectedBrands(column: PlanColumn): BrandFilter[] {
  if (Array.isArray(column.brands) && column.brands.length > 0) {
    return column.brands;
  }
  return [column.brand];
}

function selectedAssortmentProducts(column: PlanColumn): string[] {
  if (
    Array.isArray(column.assortmentProducts) &&
    column.assortmentProducts.length > 0
  ) {
    return column.assortmentProducts;
  }
  if (column.assortmentProduct) {
    return [column.assortmentProduct];
  }
  return [];
}

function matchesAnyBrand(rawBrand: string, column: PlanColumn): boolean {
  return selectedBrands(column).some(filter => matchesBrand(rawBrand, filter));
}

function matchesAssortment(rawProduct: string, column: PlanColumn): boolean {
  if ((column.assortmentMode ?? 'all') !== 'specific') return true;
  const selected = selectedAssortmentProducts(column).map(normalizeText);
  if (selected.length === 0) return true;
  return selected.includes(normalizeText(rawProduct));
}

export function filterSalesByPlanColumn(
  agentSales: Sale[],
  column: PlanColumn
): Sale[] {
  return agentSales.filter(
    sale =>
      matchesAnyBrand(sale.бренд, column) &&
      matchesAssortment(sale.товар, column)
  );
}

export function inferMetricControls(metric: MetricType): {
  base: MetricBase;
  unit: MetricUnit;
  thresholdEnabled: boolean;
} {
  switch (metric) {
    case 'grn':
      return { base: 'sum', unit: 'grn', thresholdEnabled: false };
    case 'kg':
      return { base: 'sum', unit: 'kg', thresholdEnabled: false };
    case 'pcs':
      return { base: 'sum', unit: 'pcs', thresholdEnabled: false };
    case 'tt':
      return { base: 'tt', unit: 'grn', thresholdEnabled: false };
    case 'tt_from_x':
      return { base: 'tt', unit: 'grn', thresholdEnabled: true };
    case 'tt_from_kg':
      return { base: 'tt', unit: 'kg', thresholdEnabled: true };
    case 'tt_from_pcs':
      return { base: 'tt', unit: 'pcs', thresholdEnabled: true };
    case 'tt_from_sku':
      return { base: 'tt', unit: 'sku', thresholdEnabled: true };
    case 'avg_sku':
    case 'checkin_sku':
    case 'total_sku':
      return { base: 'sku', unit: 'sku', thresholdEnabled: false };
  }
}

export function buildMetricType(
  base: MetricBase,
  unit: MetricUnit,
  thresholdEnabled: boolean
): MetricType {
  if (base === 'sum') {
    if (unit === 'kg') return 'kg';
    if (unit === 'pcs') return 'pcs';
    return 'grn';
  }

  if (base === 'tt') {
    if (unit === 'kg') return 'tt_from_kg';
    if (unit === 'pcs') return 'tt_from_pcs';
    if (unit === 'sku') return 'tt_from_sku';
    return thresholdEnabled ? 'tt_from_x' : 'tt';
  }

  return 'total_sku';
}

export function metricLabel(metric: MetricType, threshold: number): string {
  switch (metric) {
    case 'grn':
      return 'Сума грн';
    case 'kg':
      return 'Сума кг';
    case 'pcs':
      return 'Сума шт';
    case 'tt':
      return 'ТТ';
    case 'tt_from_x':
      return `ТТ від ${threshold} грн`;
    case 'tt_from_kg':
      return `ТТ від ${threshold} кг`;
    case 'tt_from_pcs':
      return `ТТ від ${threshold} шт`;
    case 'tt_from_sku':
      return `ТТ від ${threshold} SKU`;
    case 'total_sku':
      return 'SKU';
    case 'avg_sku':
      return 'Середнє SKU';
    case 'checkin_sku':
      return 'SKU (чекін)';
  }
}

function normalizeDisplayOrder(value: unknown): number | undefined {
  const raw =
    typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;

  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;

  const normalized = Math.trunc(raw);
  return normalized > 0 ? normalized : undefined;
}

export function sortPlanColumns(columns: PlanColumn[]): PlanColumn[] {
  return [...columns].sort((a, b) => {
    const aOrder = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.label.localeCompare(b.label, 'uk-UA');
  });
}

function normalizePlanColumn(column: PlanColumn, index: number): PlanColumn {
  const brands = selectedBrands(column);
  const assortmentProducts = selectedAssortmentProducts(column);
  const displayOrder = normalizeDisplayOrder(column.displayOrder) ?? index + 1;
  return {
    ...column,
    displayOrder,
    brand: brands[0] ?? column.brand,
    brands,
    assortmentMode: column.assortmentMode ?? 'all',
    assortmentProduct: assortmentProducts[0] ?? '',
    assortmentProducts,
    calcMode: column.calcMode ?? 'period',
    deptMode: column.deptMode ?? {},
    deptPlans: column.deptPlans ?? {},
  };
}

/** Мітка порогу для tt_from_* метрик */
export function thresholdLabel(metric: MetricType): string {
  if (metric === 'tt_from_x') return 'Мінімальна сума грн у ТТ';
  if (metric === 'tt_from_kg') return 'Мінімальна вага кг у ТТ';
  if (metric === 'tt_from_pcs') return 'Мінімальна кількість шт у ТТ';
  if (metric === 'tt_from_sku') return 'Мінімальна кількість SKU у ТТ';
  return 'Поріг';
}

export function isThresholdMetric(metric: MetricType): boolean {
  return (
    metric === 'tt_from_x' ||
    metric === 'tt_from_kg' ||
    metric === 'tt_from_pcs' ||
    metric === 'tt_from_sku'
  );
}

const DEFAULT_COLUMNS: PlanColumn[] = [
  {
    id: 'default-akb',
    label: 'АКБ Orimi',
    brand: 'all_orimi',
    metric: 'tt_from_x',
    threshold: 500,
    agentPlans: {
      'Гриник Ольга': 65,
      'Довга Діана': 85,
      'Лаптєва Руслана': 90,
      'Могильна Оксана': 75,
      'Сторожук Аліна': 85,
      'Ящишина Наталія': 80,
      'Кучер Аня': 65,
      'Мартинчик Альона': 75,
      'Нагорняк Світлана': 80,
      'Дюг Тетяна': 60,
      'Івасишин Денис': 65,
      'Олійник Влад': 55,
      'Швець Ірина': 70,
    },
  },
  {
    id: 'default-vkb-jockey',
    label: 'ВКБ Жокей',
    brand: 'jockey',
    metric: 'tt',
    threshold: 0,
    agentPlans: {
      'Гриник Ольга': 50,
      'Довга Діана': 50,
      'Лаптєва Руслана': 55,
      'Могильна Оксана': 55,
      'Сторожук Аліна': 60,
      'Ящишина Наталія': 55,
      'Кучер Аня': 60,
      'Мартинчик Альона': 60,
      'Нагорняк Світлана': 65,
      'Дюг Тетяна': 60,
      'Івасишин Денис': 50,
      'Олійник Влад': 50,
      'Швець Ірина': 55,
    },
  },
  {
    id: 'default-delicia-grn',
    label: 'Деліція грн',
    brand: 'delicia',
    metric: 'grn',
    threshold: 0,
    agentPlans: {
      'Гриник Ольга': 145000,
      'Довга Діана': 145000,
      'Лаптєва Руслана': 170000,
      'Могильна Оксана': 140000,
      'Сторожук Аліна': 145000,
      'Ящишина Наталія': 145000,
      'Кучер Аня': 65000,
      'Мартинчик Альона': 75000,
      'Нагорняк Світлана': 135000,
      'Дюг Тетяна': 100000,
      'Івасишин Денис': 125000,
      'Олійник Влад': 110000,
      'Швець Ірина': 120000,
    },
  },
  {
    id: 'default-delicia-vkb',
    label: 'Деліція ВКБ',
    brand: 'delicia',
    metric: 'tt',
    threshold: 0,
    agentPlans: {
      'Гриник Ольга': 98,
      'Довга Діана': 100,
      'Лаптєва Руслана': 90,
      'Могильна Оксана': 98,
      'Сторожук Аліна': 100,
      'Ящишина Наталія': 110,
      'Кучер Аня': 100,
      'Мартинчик Альона': 90,
      'Нагорняк Світлана': 100,
      'Дюг Тетяна': 108,
      'Івасишин Денис': 108,
      'Олійник Влад': 108,
      'Швець Ірина': 100,
    },
  },
];

export async function loadPlanColumns(): Promise<PlanColumn[]> {
  try {
    const columns = await fetchPlanColumns();
    if (!Array.isArray(columns) || columns.length === 0) {
      return sortPlanColumns(
        DEFAULT_COLUMNS.map((column, index) =>
          normalizePlanColumn(column, index)
        )
      );
    }
    return sortPlanColumns(
      columns.map((column, index) => normalizePlanColumn(column, index))
    );
  } catch {
    return sortPlanColumns(
      DEFAULT_COLUMNS.map((column, index) => normalizePlanColumn(column, index))
    );
  }
}

export async function savePlanColumns(cols: PlanColumn[]): Promise<void> {
  await savePlanColumnsToSheet(cols);
}

export function calcColumnFact(agentSales: Sale[], column: PlanColumn): number {
  const filtered = filterSalesByPlanColumn(agentSales, column);
  const calcMode = column.calcMode ?? 'period';

  const thresholdByMetric = (metric: MetricType): number => {
    if (metric === 'tt') return 0;
    if (metric === 'grn' || metric === 'kg' || metric === 'pcs') return 0;
    if (
      metric === 'total_sku' ||
      metric === 'checkin_sku' ||
      metric === 'avg_sku'
    )
      return 0;
    return Math.max(0, column.threshold || 0);
  };

  const saleValue = (sale: Sale, metric: MetricType): number => {
    if (metric === 'kg' || metric === 'tt_from_kg') return sale.вага || 0;
    if (metric === 'pcs' || metric === 'tt_from_pcs')
      return sale.кількість || 0;
    if (
      metric === 'tt_from_sku' ||
      metric === 'total_sku' ||
      metric === 'checkin_sku' ||
      metric === 'avg_sku'
    ) {
      return 1;
    }
    return sale.сума || 0;
  };

  const sumByThreshold = (metric: MetricType): number => {
    const threshold = thresholdByMetric(metric);
    if (threshold <= 0 || calcMode === 'period') {
      return filtered.reduce((sum, s) => sum + saleValue(s, metric), 0);
    }
    return filtered.reduce((sum, s) => {
      const value = saleValue(s, metric);
      return value >= threshold ? sum + value : sum;
    }, 0);
  };

  const countStoresByThreshold = (metric: MetricType): number => {
    const threshold = thresholdByMetric(metric);
    const byStore = new Map<string, number[]>();

    for (const s of filtered) {
      if (!s.торгова_точка) continue;
      if (!byStore.has(s.торгова_точка)) byStore.set(s.торгова_точка, []);
      byStore.get(s.торгова_точка)!.push(saleValue(s, metric));
    }

    if (calcMode === 'shipment') {
      return [...byStore.values()].filter(values =>
        values.some(v => v >= threshold)
      ).length;
    }

    return [...byStore.values()].filter(values => {
      const total = values.reduce((sum, v) => sum + v, 0);
      return total >= threshold;
    }).length;
  };

  const skuSetsByStore = (): Map<string, Set<string>> => {
    const skuByStore = new Map<string, Set<string>>();
    for (const s of filtered) {
      if (!s.торгова_точка || !s.товар) continue;
      if (!skuByStore.has(s.торгова_точка))
        skuByStore.set(s.торгова_точка, new Set());
      const key = s.товар.trim().toLocaleLowerCase('uk-UA');
      if (!key) continue;
      skuByStore.get(s.торгова_точка)!.add(key);
    }
    return skuByStore;
  };

  const skuSet = (): Set<string> => {
    const all = new Set<string>();
    for (const s of filtered) {
      if (s.товар) all.add(s.товар.trim().toLocaleLowerCase('uk-UA'));
    }
    return all;
  };

  const totalSkuAcrossStores = (): number => {
    const byStore = skuSetsByStore();
    return [...byStore.values()].reduce((sum, set) => sum + set.size, 0);
  };

  switch (column.metric) {
    case 'grn':
      return sumByThreshold('grn');

    case 'tt': {
      return countStoresByThreshold('tt');
    }

    case 'tt_from_x': {
      return countStoresByThreshold('tt_from_x');
    }

    case 'kg':
      return sumByThreshold('kg');

    case 'pcs':
      return sumByThreshold('pcs');

    case 'tt_from_kg': {
      return countStoresByThreshold('tt_from_kg');
    }

    case 'tt_from_pcs': {
      return countStoresByThreshold('tt_from_pcs');
    }

    case 'tt_from_sku': {
      return countStoresByThreshold('tt_from_sku');
    }

    case 'checkin_sku': {
      return skuSet().size;
    }

    case 'total_sku': {
      return totalSkuAcrossStores();
    }

    case 'avg_sku': {
      const storeSkus = skuSetsByStore();
      if (storeSkus.size === 0) return 0;
      const total = [...storeSkus.values()].reduce(
        (sum, set) => sum + set.size,
        0
      );
      return total / storeSkus.size;
    }
  }
}

function canAccessBrandFilterByEmail(
  email: string | null,
  filter: BrandFilter
) {
  switch (filter) {
    case 'all':
      return true;
    case 'all_orimi':
      return ORIMI_BRANDS.some(brand => canUserSeeBrand(email, brand));
    case 'greenfield':
      return canUserSeeBrand(email, 'Greenfield');
    case 'tess':
      return canUserSeeBrand(email, 'TESS');
    case 'jockey':
      return canUserSeeBrand(email, 'Жокей');
    case 'jardin':
      return canUserSeeBrand(email, 'JARDIN');
    case 'piazza':
      return canUserSeeBrand(email, 'PIAZZA');
    case 'princessa_nuri':
      return canUserSeeBrand(email, 'Принцеса Нурі');
    case 'princessa_kandi':
      return canUserSeeBrand(email, 'Принцеса Канді');
    case 'princessa_yava':
      return canUserSeeBrand(email, 'Принцеса Ява');
    case 'princessa_gita':
      return canUserSeeBrand(email, 'Принцеса Гіта');
    case 'princessa':
      return [
        'Принцеса Нурі',
        'Принцеса Канді',
        'Принцеса Ява',
        'Принцеса Гіта',
      ].some(brand => canUserSeeBrand(email, brand));
    case 'delicia':
      return canUserSeeBrand(email, 'Деліція');
  }
}

export function canViewPlanColumnByEmail(
  email: string | null,
  column: PlanColumn
): boolean {
  const brands = selectedBrands(column);
  if (brands.length === 0) return true;
  return brands.some(filter => canAccessBrandFilterByEmail(email, filter));
}

export function calcColumnFactDetailsByStore(
  agentSales: Sale[],
  column: PlanColumn
): StoreFactDetail[] {
  const filtered = filterSalesByPlanColumn(agentSales, column);
  const calcMode = column.calcMode ?? 'period';

  const saleValue = (sale: Sale, metric: MetricType): number => {
    if (metric === 'kg' || metric === 'tt_from_kg') return sale.вага || 0;
    if (metric === 'pcs' || metric === 'tt_from_pcs')
      return sale.кількість || 0;
    if (
      metric === 'tt_from_sku' ||
      metric === 'total_sku' ||
      metric === 'checkin_sku' ||
      metric === 'avg_sku'
    ) {
      return 1;
    }
    return sale.сума || 0;
  };

  const sortDesc = (rows: StoreFactDetail[]): StoreFactDetail[] =>
    rows.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.store.localeCompare(b.store, 'uk-UA');
    });

  const sumMetricByStore = (metric: MetricType): StoreFactDetail[] => {
    const sums = new Map<string, number>();
    for (const sale of filtered) {
      const store = sale.торгова_точка?.trim();
      if (!store) continue;
      const prev = sums.get(store) ?? 0;
      sums.set(store, prev + saleValue(sale, metric));
    }
    return sortDesc(
      [...sums.entries()].map(([store, value]) => ({ store, value }))
    );
  };

  const ttMetricByStore = (metric: MetricType): StoreFactDetail[] => {
    const byStore = new Map<string, number[]>();

    for (const sale of filtered) {
      const store = sale.торгова_точка?.trim();
      if (!store) continue;
      if (!byStore.has(store)) byStore.set(store, []);
      byStore.get(store)!.push(saleValue(sale, metric));
    }

    const rows = [...byStore.entries()].map(([store, values]) => {
      if (calcMode === 'shipment') {
        const maxShipment = values.reduce(
          (max, current) => (current > max ? current : max),
          0
        );
        return { store, value: maxShipment };
      }

      const total = values.reduce((sum, current) => sum + current, 0);
      return { store, value: total };
    });

    return sortDesc(rows);
  };

  const skuMetricByStore = (): StoreFactDetail[] => {
    const skuByStore = new Map<string, Set<string>>();
    for (const sale of filtered) {
      const store = sale.торгова_точка?.trim();
      const product = sale.товар?.trim().toLocaleLowerCase('uk-UA');
      if (!store || !product) continue;
      if (!skuByStore.has(store)) skuByStore.set(store, new Set<string>());
      skuByStore.get(store)!.add(product);
    }

    return sortDesc(
      [...skuByStore.entries()].map(([store, products]) => ({
        store,
        value: products.size,
      }))
    );
  };

  switch (column.metric) {
    case 'grn':
      return sumMetricByStore('grn');
    case 'kg':
      return sumMetricByStore('kg');
    case 'pcs':
      return sumMetricByStore('pcs');
    case 'tt':
      return ttMetricByStore('tt');
    case 'tt_from_x':
      return ttMetricByStore('tt_from_x');
    case 'tt_from_kg':
      return ttMetricByStore('tt_from_kg');
    case 'tt_from_pcs':
      return ttMetricByStore('tt_from_pcs');
    case 'tt_from_sku':
      return ttMetricByStore('tt_from_sku');
    case 'checkin_sku':
    case 'total_sku':
    case 'avg_sku':
      return skuMetricByStore();
  }
}

export function isGrnMetric(metric: MetricType): boolean {
  return metric === 'grn' || metric === 'kg' || metric === 'pcs';
}
