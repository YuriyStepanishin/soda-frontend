import { useEffect, useRef, type ReactNode } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { useNavigationBack } from '../Navigation/useNavigationBack';
import styles from './AppShell.module.css';

export type NavigationItem = { id: string; label: string; symbol: 'home' | 'sales' | 'days' | 'stores' | 'debt' | 'more'; onClick: () => void };
type Props = { children: ReactNode; items: NavigationItem[]; active: string; account: ReactNode; tenant: string; navigationKey: string; viewTitle?: string };

export default function AppShell({ children, items, active, account, tenant, navigationKey, viewTitle }: Props) {
  const content = useRef<HTMLElement>(null);
  const back = useNavigationBack();
  useEffect(() => { content.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [navigationKey]);
  const title = viewTitle || items.find(item => item.id === active)?.label || 'Робочий простір';

  return <div className={styles.shell}>
    <a href="#soda-main" className={styles.skipLink}>Перейти до вмісту</a>
    <header className={styles.topbar}>
      {back && <nav className={styles.returnNavigation} aria-label="Повернення">
        <button type="button" className={styles.back} onClick={back.onBack} aria-label={back.label} title={back.label}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg><span>{back.label}</span></button>
        <button type="button" className={styles.back} onClick={() => items.find(item => item.id === 'home')?.onClick()} aria-label="Головна" title="Головна"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7v11h-6v-7H9v7H3Z" /></svg><span>Головна</span></button>
      </nav>}
      <div className={styles.heading}><strong>{title}</strong><small>{tenant ? tenant.toUpperCase() : 'SODA'}</small></div>
      <div className={styles.toolbar}>{!back && <ThemeSwitcher />}{account}</div>
    </header>
    <main id="soda-main" ref={content} tabIndex={-1} className={styles.content}>{children}</main>
  </div>;
}
