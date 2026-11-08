export type Theme = 'light' | 'dark';
export const THEME_KEY = 'soda:theme';
export const THEME_EVENT = 'soda:theme-change';
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  return saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
}
export function currentTheme(): Theme { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
export function applyTheme(theme: Theme, persist = true): void {
  if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep the theme for this visit. */ } }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#06162e' : '#f6f8fb');
  window.dispatchEvent(new Event(THEME_EVENT));
}
export function initializeTheme(): void {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* Use the system setting. */ }
  applyTheme(resolveTheme(saved, window.matchMedia('(prefers-color-scheme: dark)').matches), false);
}
export function subscribeTheme(listener: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => { initializeTheme(); listener(); };
  const systemUpdate = () => { try { if (localStorage.getItem(THEME_KEY)) return; } catch { /* Follow the system. */ } update(); };
  const storage = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) update(); };
  window.addEventListener(THEME_EVENT, listener); window.addEventListener('storage', storage); media.addEventListener('change', systemUpdate);
  return () => { window.removeEventListener(THEME_EVENT, listener); window.removeEventListener('storage', storage); media.removeEventListener('change', systemUpdate); };
}
