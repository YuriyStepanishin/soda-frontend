import type { ReactNode } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import styles from './AppShell.module.css';
export type NavigationItem = { id: string; label: string; symbol: 'home' | 'sales' | 'days' | 'stores'; onClick: () => void };
function NavIcon({ name }: { name: NavigationItem['symbol'] }) {
  const paths = {
    home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    sales: 'M4 20V11h4v9m4 0V4h4v16m4 0V8h2v12',
    days: 'M4 6h16v15H4Zm3-3v6m10-6v6M4 11h16m-12 4h2m4 0h2',
    stores: 'M3 9 5 3h14l2 6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M9 21v-6h6v6',
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export default function AppShell({ children, items, active, account, onProfile, tenant, showThemeSwitcher = false }: { children: ReactNode; items: NavigationItem[]; active: string; account: ReactNode; onProfile: () => void; tenant: string; showThemeSwitcher?: boolean }) {
  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Основна навігація">
      <a className={styles.brand} href="#" onClick={event => { event.preventDefault(); items[0]?.onClick(); }}><img src="/icons/soda-192.png" alt="" width="40" height="40" /><strong>SODA</strong></a>
      <small className={styles.tenant}>{tenant.toUpperCase()}</small>
      <nav>{items.map(item => <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={item.onClick}><NavIcon name={item.symbol} /><span>{item.label}</span></button>)}<button type="button" onClick={onProfile}><span aria-hidden="true">◉</span><span>Профіль</span></button></nav>
      <small className={styles.version}>SODA · v{__APP_VERSION__}</small>
    </aside>
    <div className={styles.workspace}><header className={styles.topbar}>
      <a className={styles.mobileBrand} href="#" onClick={event => { event.preventDefault(); items[0]?.onClick(); }}><img src="/icons/soda-192.png" alt="" width="32" height="32" /><strong>SODA</strong></a>
      <span className={styles.context}>{items.find(item => item.id === active)?.label ?? 'SODA'}{tenant ? ` · ${tenant.toUpperCase()}` : ''}</span>
      <div className={styles.toolbar}>{showThemeSwitcher && <ThemeSwitcher />}{account}</div>
    </header><div className={styles.content}>{children}</div></div>
  </div>;
}
