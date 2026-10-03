import { fetchSales } from './fetchOlgatorgSales';

export type RouteRow = {
  day: string;
  store: string;
  agent: string;
};

function parseDateObject(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ymdMatch = trimmed.match(
    /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:\D|$)/
  );
  if (ymdMatch) {
    const [, yearRaw, monthRaw, dayRaw] = ymdMatch;
    const parsed = new Date(
      Number(yearRaw),
      Number(monthRaw) - 1,
      Number(dayRaw)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dmyMatch = trimmed.match(
    /^([0-9]{1,2})[./-]([0-9]{1,2})[./-]([0-9]{2,4})(?:\D|$)/
  );
  if (dmyMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dmyMatch;
    const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const parsed = new Date(year, Number(monthRaw) - 1, Number(dayRaw));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getRouteDayLabel(date: Date): string {
  const day = date.getDay();
  if (day === 1) return 'понеділок';
  if (day === 2) return 'вівторок';
  if (day === 3) return 'середа';
  if (day === 4) return 'четвер';
  return 'пʼятниця';
}

function normalizeValue(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

async function loadRoutes(filters: Record<string, string> = {}): Promise<RouteRow[]> {
  const sales = await fetchSales(filters);
  const unique = new Map<string, RouteRow>();

  for (const sale of sales) {
    const date = parseDateObject(sale.дата);
    const store = normalizeValue(sale.торгова_точка || sale.точка);
    const agent = normalizeValue(sale.агент);

    if (!date || !store || !agent) continue;

    const row: RouteRow = {
      day: getRouteDayLabel(date),
      store,
      agent,
    };

    unique.set(`${row.day}::${row.store}::${row.agent}`, row);
  }

  return Array.from(unique.values());
}

export async function fetchRoutes(): Promise<RouteRow[]> {
  return loadRoutes();
}

export async function fetchRoutesByFilters(
  filters: Record<string, string>
): Promise<RouteRow[]> {
  return loadRoutes(filters);
}
