import { useEffect, useRef, useState, type ReactNode } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { useNavigationBack } from '../Navigation/useNavigationBack';
import styles from './AppShell.module.css';

export type NavigationItem = { id: string; label: string; symbol: 'home' | 'sales' | 'days' | 'stores' | 'debt' | 'more'; onClick: () => void; group?: 'Аналітика' | 'Фотозвіт' | 'Дебіторка' | 'Замовлення' | 'Мій календар' };
type Props = { children: ReactNode; items: NavigationItem[]; active: string; account: ReactNode; tenant: string; navigationKey: string; viewTitle?: string };

export default function AppShell({ children, items, active, account, tenant, navigationKey, viewTitle }: Props) {
  const content = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const back = useNavigationBack();
  useEffect(() => { content.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [navigationKey]);
  const title = viewTitle || items.find(item => item.id === active)?.label || 'Робочий простір';
  const groups = ['Замовлення', 'Аналітика', 'Дебіторка', 'Фотозвіт', 'Мій календар'] as const;
  const navigate = (item: NavigationItem) => { setMenuOpen(false); item.onClick(); };

  return <div className={styles.shell}>
    <a href="#soda-main" className={styles.skipLink}>Перейти до вмісту</a>
    <header className={styles.topbar}>
      {back && <nav className={styles.returnNavigation} aria-label="Повернення">
        <button type="button" className={styles.back} onClick={back.onBack} aria-label={back.label} title={back.label}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg><span>{back.label}</span></button>
        <button type="button" className={styles.back} onClick={() => items.find(item => item.id === 'home')?.onClick()} aria-label="Головна" title="Головна"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7v11h-6v-7H9v7H3Z" /></svg><span>Головна</span></button>
      </nav>}
      <div className={styles.heading}><strong>{title}</strong><small>{tenant ? tenant.toUpperCase() : 'SODA'}</small></div>
      <div className={styles.toolbar}>{!back && <ThemeSwitcher />}<button type="button" className={styles.menuButton} onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="soda-section-menu">☰ Меню</button></div>
    </header>
    {menuOpen && <nav id="soda-section-menu" className={styles.sectionMenu} aria-label="Меню SODA">
      <button type="button" className={styles.menuLink} onClick={() => navigate(items[0])}>⌂ Головна</button>
      {groups.map(group => {
        const entries = items.filter(item => item.group === group);
        const placeholder = group === 'Замовлення' || group === 'Мій календар';
        return <div key={group} className={styles.menuGroup}>
          <button type="button" className={styles.menuLink} onClick={() => setExpanded(value => value === group ? null : group)} aria-expanded={expanded === group}>
            {group} <span aria-hidden="true">{expanded === group ? '⌃' : '⌄'}</span>
          </button>
          {expanded === group && <div className={styles.menuChildren}>
            {placeholder && <span className={styles.menuMuted}>У розробці</span>}
            {!placeholder && entries.map(item => <button type="button" key={item.id} className={styles.menuChild} onClick={() => navigate(item)}>{item.label}</button>)}
            {!placeholder && !entries.length && <span className={styles.menuMuted}>Немає доступних підрозділів</span>}
          </div>}
        </div>;
      })}
      <div className={styles.menuGroup}><h3 className={styles.menuAccountTitle}>Особистий кабінет</h3><div className={styles.menuAccount}>{account}</div></div>
    </nav>}
    <main id="soda-main" ref={content} tabIndex={-1} className={styles.content}>{children}</main>
  </div>;
}
