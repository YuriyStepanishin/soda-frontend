import Dexie, { type Table } from 'dexie';
import { completeHistoryDetailUrl } from '../utils/historyOfflineRequests';
import { API_BASE_URL, AUTH_TOKEN_KEY, AUTH_USER_KEY } from './config';
import { cachedRead, OFFLINE_MAX_AGE, type OfflineEntry, type ReadStatus } from '../utils/offlineReadCache';

class SalesOfflineDB extends Dexie {
  entries!: Table<OfflineEntry, string>;
  constructor() {
    super('SodaSalesOfflineV1');
    this.version(1).stores({ entries: 'key, scope, savedAt' });
  }
}
const db = new SalesOfflineDB();
export const OFFLINE_SESSION_KEY = 'soda:offline-session';
let generation = 0;
const statuses = new Map<string, ReadStatus>();
const paths = new Set(['/api/sales/report', '/api/sales/filters', '/api/sales/by-days', '/api/sales/by-days/filters', '/api/sales/route-history']);
export const OFFLINE_STATUS_EVENT = 'soda:offline-sales-status';
const emit = () => window.dispatchEvent(new Event(OFFLINE_STATUS_EVENT));
export type HistorySyncStatus = { completed: number; total: number; running: boolean; savedAt: number };
export function setHistorySyncStatus(value: HistorySyncStatus): void {
  saveSalesSettings('history-sync', value);
  emit();
}
export async function savedSalesResponse<T>(url: string): Promise<T | undefined> {
  const scope = salesOfflineScope();
  if (!scope) return;
  const canonical = new URL(url);
  canonical.searchParams.sort();
  const entry = await db.entries.get(`${scope}\n${canonical}`).catch(() => undefined);
  if (entry && Date.now() - entry.savedAt < 15 * 60 * 1000) return entry.data as T;
}


function canonicalPath(path: string): string {
  const url = new URL(path, API_BASE_URL);
  url.searchParams.sort();
  return `${url.pathname}${url.search}`;
}

export function salesOfflineScope(): string | null {
  try {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return null;
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
    if (!user?.email || !user.role) return null;
    const tenant = user.role === 'admin' ? localStorage.getItem('activeTenant') : user.tenant;
    if (!['laska', 'olgatorg'].includes(tenant)) return null;
    let session = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!session) {
      session = crypto.randomUUID();
      localStorage.setItem(OFFLINE_SESSION_KEY, session);
    }
    // Raw role and all backend restrictions are part of the scope; JWT is never stored.
    return JSON.stringify([API_BASE_URL, tenant, session, user]);
  } catch { return null; }
}

export function getSalesReadStatuses(paths: string[]): ReadStatus[] {
  const scope = salesOfflineScope();
  return paths.flatMap(path => {
    const status = statuses.get(`${scope}\n${canonicalPath(path)}`);
    return status ? [status] : [];
  });
}

export function readSalesSettings<T>(name: string): T | null {
  try {
    const scope = salesOfflineScope();
    if (!scope) return null;
    const saved = JSON.parse(localStorage.getItem(`soda:offline-settings:${name}:${scope}`) || 'null');
    return saved && Date.now() - saved.savedAt <= OFFLINE_MAX_AGE ? saved.value as T : null;
  } catch { return null; }
}

export function saveSalesSettings(name: string, value: unknown): void {
  try {
    const scope = salesOfflineScope();
    if (scope) localStorage.setItem(`soda:offline-settings:${name}:${scope}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch { /* Report fetching still works when browser storage is unavailable. */ }
}

export async function savedSalesRequests(): Promise<Array<{ url: string; savedAt: number }>> {
  const scope = salesOfflineScope();
  if (!scope) return [];
  try {
    const requests: Array<{ url: string; savedAt: number }> = [];
    await db.entries.where('scope').equals(scope).each(entry => {
      try {
        const url = entry.key.slice(scope.length + 1);
        const parsed = new URL(url);
        if (parsed.origin === new URL(API_BASE_URL).origin && paths.has(parsed.pathname)) requests.push({ url, savedAt: entry.savedAt });
      } catch { /* Ignore a damaged cache key without losing valid requests. */ }
    });
    return requests.sort((a, b) => b.savedAt - a.savedAt);
  } catch { return []; }
}

export async function clearSalesOffline(): Promise<void> {
  generation++;
  statuses.clear();
  emit();
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('soda:offline-settings:')) localStorage.removeItem(key);
    }
  } catch { /* IndexedDB cleanup must still run if localStorage is blocked. */ }
  await db.entries.clear().catch(() => {});
}

export async function offlineSalesGet<T>(
  path: string, url: string, headers: Headers, signal: AbortSignal | undefined,
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const scope = salesOfflineScope();
  const pathname = new URL(path, API_BASE_URL).pathname;
  if (!scope || !paths.has(pathname)) return parse(await fetch(url, { headers, signal }));
  const requestGeneration = generation;
  const isCurrent = () => generation === requestGeneration && salesOfflineScope() === scope;
  const canonicalUrl = new URL(url);
  canonicalUrl.searchParams.sort();
  const key = `${scope}\n${canonicalUrl}`;
  return cachedRead<T>({
    key, scope, signal, isCurrent,
    isOffline: () => navigator.onLine === false,
    storage: {
      get: async key => {
        const exact = await db.entries.get(key);
        const completeUrl = completeHistoryDetailUrl(url);
        const complete = completeUrl ? await db.entries.get(`${scope}\n${completeUrl}`) : undefined;
        // Same scope, date, store and filters; only grouping fields differ.
        return complete && (!exact || complete.savedAt > exact.savedAt) ? { ...complete, key } : exact;
      },
      removeScope: async scope => {
        generation++;
        statuses.clear();
        emit();
        await db.entries.where('scope').equals(scope).delete();
      },
      put: async entry => {
        if (entry.bytes > 8 * 1024 * 1024) throw new Error('Звіт завеликий для збереження');
        await db.transaction('rw', db.entries, async () => {
          if (!isCurrent()) return;
          await db.entries.where('savedAt').below(Date.now() - OFFLINE_MAX_AGE).delete();
          await db.entries.put(entry);
          const history = pathname === '/api/sales/route-history';
          const all = (await db.entries.orderBy('savedAt').toArray()).filter(item =>
            new URL(item.key.slice(item.scope.length + 1)).pathname === '/api/sales/route-history' ? history : !history);
          const maxBytes = (history ? 200 : 25) * 1024 * 1024;
          const maxEntries = history ? 10000 : 50;
          let size = all.reduce((sum, item) => sum + item.bytes, 0);
          let count = all.length;
          for (const item of all) {
            if (size <= maxBytes && count <= maxEntries) break;
            await db.entries.delete(item.key);
            size -= item.bytes;
            count--;
          }
        });
      },
    },
    load: async hasCopy => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timer = window.setTimeout(() => controller.abort(new DOMException('Повільне з’єднання', 'TimeoutError')), hasCopy ? 8000 : 30000);
      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        const data = await parse(response);
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw Object.assign(new Error('Сервер не сформував звіт'), { status: 422 });
        }
        return data;
      } finally {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
    onStatus: status => {
      // Keep only the current result per endpoint, not a history of stale warnings.
      statuses.set(`${scope}\n${pathname === '/api/sales/route-history' ? canonicalPath(url) : pathname}`, status);
      if (statuses.size > 100) statuses.delete(statuses.keys().next().value!);
      emit();
    },
  });
}
