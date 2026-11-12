import { useEffect, useRef, useState, type ReactNode } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import InstallButton from '../InstallButton/InstallButton';
import Modal from '../Navigation/Modal';
import { useNavigationBack } from '../Navigation/useNavigationBack';
import styles from './AppShell.module.css';

export type NavigationItem = { id: string; label: string; symbol: 'home' | 'sales' | 'days' | 'stores' | 'debt' | 'more'; onClick: () => void };
function NavIcon({ name }: { name: NavigationItem['symbol'] }) {
  const paths = {
    debt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8m-8 4h5',
    home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    sales: 'M4 20V11h4v9m4 0V4h4v16m4 0V8h2v12',
    days: 'M4 6h16v15H4Zm3-3v6m10-6v6M4 11h16m-12 4h2m4 0h2',
    stores: 'M3 9 5 3h14l2 6M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M9 21v-6h6v6',
    more: 'M4 6h16M4 12h16M4 18h16',
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

type Props = { children: ReactNode; items: NavigationItem[]; active: string; account: ReactNode; onProfile: () => void; tenant: string; navigationKey: string; viewTitle?: string };
export default function AppShell({ children, items, active, account, onProfile, tenant, navigationKey, viewTitle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const content = useRef<HTMLElement>(null);
  const back = useNavigationBack();
  useEffect(() => { content.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [navigationKey]);
  const primary = items.filter(item => ['home', 'sales', 'route-history', 'receivables'].includes(item.id));
  const title = viewTitle || items.find(item => item.id === active)?.label || 'Робочий простір';
  const renderItem = (item: NavigationItem, compact = false) => <button key={item.id} type="button" title={item.label} aria-current={(active === item.id || (compact && item.id === 'sales' && active === 'sales-by-days')) && !viewTitle ? 'page' : undefined} onClick={() => { setMenuOpen(false); item.onClick(); }}><NavIcon name={item.symbol} /><span>{compact && item.id === 'route-history' ? 'Точки' : item.label}</span></button>;
  return <div className={styles.shell}>
    <a href="#soda-main" className={styles.skipLink}>Перейти до вмісту</a>
    <aside className={styles.sidebar} aria-label="Основна навігація">
      <button className={styles.brand} type="button" onClick={() => items[0]?.onClick()} aria-label="SODA — головна"><img src="/icons/soda-192.png" alt="" width="40" height="40" /><strong>SODA</strong></button>
      <small className={styles.tenant}>{tenant.toUpperCase()}</small>
      <nav>{items.map(item => renderItem(item))}</nav>
      <footer className={styles.sidebarFooter}><ThemeSwitcher /><InstallButton /><small className={styles.version}>SODA · v{__APP_VERSION__}</small></footer>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        {back && <button type="button" className={styles.back} onClick={back.onBack} aria-label={back.label}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg><span>{back.label}</span></button>}
        <div className={styles.heading}><strong>{title}</strong><small>{tenant.toUpperCase()}</small></div>
        <div className={styles.toolbar}>{account}</div>
      </header>
      <main id="soda-main" ref={content} tabIndex={-1} className={styles.content}>{children}</main>
      <nav className={styles.mobileNav} aria-label="Основні розділи">{primary.map(item => renderItem(item, true))}<button type="button" aria-label="Відкрити всі розділи" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><NavIcon name="more" /><span>Меню</span></button></nav>
    </div>
    {menuOpen && <Modal title="Меню SODA" onClose={() => setMenuOpen(false)}><nav className={styles.menuItems} aria-label="Усі розділи">{items.map(item => renderItem(item))}<button type="button" onClick={() => { setMenuOpen(false); onProfile(); }}><span aria-hidden="true">◉</span><span>Профіль</span></button></nav><div className={styles.menuSettings}><span>Оформлення</span><ThemeSwitcher /></div><InstallButton /><small className={styles.version}>SODA · v{__APP_VERSION__}</small></Modal>}
  </div>;
}
