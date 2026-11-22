import { apiGet } from './client';
import { getAuthSession } from './auth';
import { API_BASE_URL } from './config';
import { readSalesSettings, saveSalesSettings, savedSalesResponse, savedSalesRequests, salesOfflineScope, setHistorySyncStatus } from './salesOffline';
import { historyDetailRequests } from '../utils/historyOfflineRequests';
import { refreshSalesQueue } from '../utils/backgroundSalesQueue';

// One daily offline snapshot per authenticated scope. Retry only unfinished snapshots on reconnect.
// IndexedDB remains the durable source for offline reading; no minute-by-minute polling.
export function startBackgroundSalesSync(): () => void {
  const scope = salesOfflineScope();
  if (!scope) return () => {};
  let active: AbortController | null = null;
  let stopped = false;
  const dayInKyiv = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const completedToday = () => readSalesSettings<string>('history-sync-complete-day') === dayInKyiv();
  const isCurrent = () => !stopped && salesOfflineScope() === scope && navigator.onLine;
  const run = async () => {
    if (active || !isCurrent() || completedToday()) return;
    const controller = new AbortController();
    active = controller;
    try {
      // Validate JWT against the live backend; no secret or token is cached in IndexedDB.
      await apiGet('/api/auth/session', { authenticated: true, signal: controller.signal });
      // Imports arrive at most once per day: no revision polling during the day.
      // A new Kyiv calendar day refreshes the snapshot once.
      const saved = await savedSalesRequests();
      if (!isCurrent()) return;
      const user = getAuthSession()?.user;
      if (!user) return;
      const date = dayInKyiv();
      const history = readSalesSettings<{ department?: string; agent?: string }>('history');
      const base = new URL(API_BASE_URL);
      const defaults: URL[] = [];
      const lists: URL[] = [];
      for (const period of ['4weeks', '4months']) {
        const url = new URL('/api/sales/route-history', base);
        url.searchParams.set('period', period);
        url.searchParams.set('asOfDate', date);
        // Admin tenant is selected separately; derive it from the scoped session.
        const tenant = user.role === 'admin' ? localStorage.getItem('activeTenant') : user.tenant;
        url.searchParams.set('groupingFields', tenant === 'olgatorg' ? 'tm' : 'group');
        if (tenant === 'laska') url.searchParams.set('view', 'stores');
        const agent = user.role === 'agent' ? user.representative : history?.agent;
        if (agent) url.searchParams.set('ta', agent);
        if (history?.department) url.searchParams.set('department', history.department);
        defaults.push(url);
        if (tenant === 'laska') lists.push(url);
      }
      const requests = [...saved.filter(request => new URL(request.url).pathname !== '/api/sales/route-history').map(request => ({ ...request, savedAt: 0 }))];
      for (const url of defaults) {
        if (!lists.includes(url)) requests.unshift({ url: url.toString(), savedAt: 0 });
      }
      const read = async (url: string, signal: AbortSignal) => {
        const request = new URL(url);
        return apiGet(`${request.pathname}${request.search}`, { authenticated: true, signal });
      };
      const primaryComplete = await refreshSalesQueue({
        requests, signal: controller.signal, isCurrent,
        yieldToForeground: () => new Promise(resolve => window.setTimeout(resolve, 1000)),
        read,
      });
      // Do not mark a revision complete unless every primary response is on disk.
      const storedPrimary = await savedSalesRequests();
      const storedPrimaryUrls = new Set(storedPrimary.map(entry => canonicalUrl(entry.url)));
      const primaryStored = requests.every(entry => storedPrimaryUrls.has(canonicalUrl(entry.url)));
      // Discover every store, including cards the user has never opened.
      const details = new Map<string, { url: string; savedAt: number }>();
      const copies = new Map((await savedSalesRequests()).map(entry => [canonicalUrl(entry.url), entry.savedAt]));
      for (const list of lists) {
        if (!isCurrent() || controller.signal.aborted) return;
        const response = (await savedSalesResponse(list.toString()) ?? await read(list.toString(), controller.signal)) as { data?: { stores: Array<{ code?: string }> }; stores?: Array<{ code?: string }> };
        for (const url of historyDetailRequests(list.toString(), response.data?.stores ?? response.stores ?? [])) {
          details.set(url, { url, savedAt: copies.has(url) ? copies.get(url)! : 0 });
        }
      }
      if (!history) saveSalesSettings('history', { department: '', agent: '', period: 'weeks', groupingFields: ['group'], asOfDate: date });
      let completed = [...details.values()].filter(entry => entry.savedAt > 0).length;
      const update = (running: boolean) => {
        if (isCurrent()) setHistorySyncStatus({ completed, total: details.size, running, savedAt: Date.now() });
      };
      update(true);
      const detailsComplete = await refreshSalesQueue({
        // Missing cards first. Completed cards survive interruption and are skipped on resume.
        requests: [...details.values()].sort((a, b) => a.savedAt - b.savedAt),
        signal: controller.signal, isCurrent,
        read: async (url, signal) => {
          await read(url, signal);
          // A full disk must not be reported as a completed offline download.
          if (!await savedSalesResponse(url)) throw new Error('Не вдалося зберегти історію на пристрої');
          completed++;
          update(true);
        },
        yieldToForeground: () => new Promise(resolve => window.setTimeout(resolve, 250)),
      });
      update(false);
      if (isCurrent() && primaryComplete && primaryStored && detailsComplete) saveSalesSettings('history-sync-complete-day', date);
    } catch { /* Background refresh must not interrupt the user's work. */ }
    finally { active = null; }
  };
  const start = () => { void run(); };
  const visibility = () => {
    if (!navigator.onLine) active?.abort();
    else if (document.visibilityState === 'visible') start();
  };
  const first = window.setTimeout(start, 3000);
  window.addEventListener('online', start);
  window.addEventListener('offline', visibility);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    stopped = true;
    active?.abort();
    window.clearTimeout(first);
    window.removeEventListener('online', start);
    window.removeEventListener('offline', visibility);
    document.removeEventListener('visibilitychange', visibility);
  };
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.searchParams.sort();
  return url.toString();
}
