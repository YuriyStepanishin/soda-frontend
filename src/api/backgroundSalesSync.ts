import { apiGet } from './client';
import { getAuthSession } from './auth';
import { API_BASE_URL } from './config';
import { readSalesSettings, savedSalesRequests, salesOfflineScope } from './salesOffline';
import { refreshSalesQueue } from '../utils/backgroundSalesQueue';

// Refresh a bounded set of previously used reports without opening their screens.
// Only the existing backend is queried; hidden/offline sessions do no background work.
export function startBackgroundSalesSync(): () => void {
  const scope = salesOfflineScope();
  if (!scope) return () => {};
  let active: AbortController | null = null;
  let stopped = false;
  const isCurrent = () => !stopped && salesOfflineScope() === scope && navigator.onLine && document.visibilityState !== 'hidden';
  const run = async () => {
    if (active || !isCurrent()) return;
    const controller = new AbortController();
    active = controller;
    try {
      const saved = await savedSalesRequests();
      if (!isCurrent()) return;
      const user = getAuthSession()?.user;
      if (!user) return;
      const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
      const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      const history = readSalesSettings<{ department?: string; agent?: string }>('history');
      const base = new URL(API_BASE_URL);
      const defaults = [new URL('/api/sales/filters', base)];
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
      }
      const known = new Map(saved.map(request => [canonicalUrl(request.url), request]));
      const requests = [...saved];
      for (const url of defaults) {
        if (!known.has(canonicalUrl(url.toString()))) requests.push({ url: url.toString(), savedAt: 0 });
      }
      await refreshSalesQueue({
        requests, signal: controller.signal, isCurrent,
        yieldToForeground: () => new Promise(resolve => window.setTimeout(resolve, 1000)),
        read: async (url, signal) => {
          const request = new URL(url);
          await apiGet(`${request.pathname}${request.search}`, { authenticated: true, signal });
        },
      });
    } catch { /* Background refresh must not interrupt the user's work. */ }
    finally { active = null; }
  };
  const start = () => { void run(); };
  const visibility = () => {
    if (!navigator.onLine || document.visibilityState === 'hidden') active?.abort();
    else start();
  };
  const first = window.setTimeout(start, 3000);
  const timer = window.setInterval(start, 15 * 60 * 1000);
  window.addEventListener('online', start);
  window.addEventListener('offline', visibility);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    stopped = true;
    active?.abort();
    window.clearTimeout(first);
    window.clearInterval(timer);
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
