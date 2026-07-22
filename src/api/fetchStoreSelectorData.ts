import { fetchSales } from './fetchSales';

export type StoreSelectorSource = 'sales' | 'bonus';

export type StoreSelectorRow = {
  department: string;
  representative: string;
  store: string;
};

export async function fetchStoreSelectorData(
  source: StoreSelectorSource
): Promise<StoreSelectorRow[]> {
  void source;

  const sales = await fetchSales();
  const seen = new Set<string>();
  const rows: StoreSelectorRow[] = [];

  for (const item of sales) {
    const department = item.відділ;
    const representative = item.агент;
    const store = item.торгова_точка;

    if (!department || !representative || !store) continue;

    const key = `${department}::${representative}::${store}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      department,
      representative,
      store,
    });
  }

  return rows;
}
