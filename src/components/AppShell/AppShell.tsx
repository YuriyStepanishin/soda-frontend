import { useEffect, useRef, useState, type ReactNode } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import AppDialog from '../Navigation/AppDialog';
import { useNavigationBack } from '../Navigation/useNavigationBack';
import styles from './AppShell.module.css';

export type NavigationItem = { id: string; label: string; symbol: 'home' | 'sales' | 'days' | 'stores' | 'debt' | 'more'; onClick: () => void; group?: 'Аналітика' | 'Фотозвіт' | 'Дебіторка' | 'Замовлення' | 'Мій календар' | 'Довідники' };
type Props = { children: ReactNode; items: NavigationItem[]; active: string; account: ReactNode; tenant: string; navigationKey: string; viewTitle?: string };

export default function AppShell({ children, items, active, account, tenant, navigationKey, viewTitle }: Props) {
  const content = useRef<HTMLElement>(null);
  const [updateState, setUpdateState] = useState<
    'idle' | 'checking' | 'ready' | 'current' | 'offline' | 'error'
  >('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [photoPercent, setPhotoPercent] = useState<number | null>(null);
  useEffect(() => {
    const onPhotoProgress = (event: Event) => setPhotoPercent((event as CustomEvent<number>).detail);
    window.addEventListener('soda:laska-photo-progress', onPhotoProgress);
    return () => window.removeEventListener('soda:laska-photo-progress', onPhotoProgress);
  }, []);
  useEffect(() => {
    if (photoPercent !== 100) return;
    const timer = window.setTimeout(() => setPhotoPercent(null), 3000);
    return () => window.clearTimeout(timer);
  }, [photoPercent]);
  const compareVersions = (a: string, b: string): number => {
    const parse = (value: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())?.slice(1).map(Number);
    const left = parse(a);
    const right = parse(b);
    if (!left || !right) return 0;
    for (let index = 0; index < 3; index += 1) {
      if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
    }
    return 0;
  };
  const handleRefreshApp = async (approved = false) => {
    if (updateState === 'checking') return;
    if (updateAvailable) {
      if (!approved) { setConfirmUpdate(true); return; }
      setConfirmUpdate(false);
      setUpdateState('checking');
      setUpdateMessage('Застосовуємо оновлення…');
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.waiting) {
        const controllerChanged = new Promise<void>(resolve => {
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => resolve(),
            { once: true }
          );
          window.setTimeout(resolve, 5000);
        });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        await controllerChanged;
      }
      window.location.reload();
      return;
    }
    setUpdateState('checking');
    setUpdateMessage('Перевіряємо версію на сервері…');
    try {
      if (!navigator.onLine) {
        setUpdateState('offline');
        setUpdateMessage('Немає інтернету. Перевірку оновлень відкладено.');
        return;
      }
      const response = await fetch('/version.json?check=' + Date.now(), {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Не вдалося отримати версію сервера');
      const payload: { version?: string } = await response.json();
      if (!payload.version) throw new Error('Відсутній номер версії');
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      }
      if (compareVersions(payload.version, __APP_VERSION__) > 0) {
        setUpdateAvailable(true);
        setUpdateState('ready');
        setUpdateMessage(
          'Доступна версія ' +
            payload.version +
            '. Натисніть «Встановити оновлення».'
        );
      } else {
        setUpdateAvailable(false);
        setUpdateState('current');
        setUpdateMessage('У вас актуальна версія ' + __APP_VERSION__ + '.');
      }
    } catch (error) {
      setUpdateState('error');
      setUpdateMessage(
        error instanceof Error ? error.message : 'Помилка перевірки оновлення'
      );
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sectionLanding, setSectionLanding] = useState<string | null>(null);
  useEffect(() => {
    const fromHome = (event: Event) => { setSectionLanding((event as CustomEvent<string>).detail); setMenuOpen(false); };
    window.addEventListener('soda:open-section', fromHome);
    return () => window.removeEventListener('soda:open-section', fromHome);
  }, []);
  const back = useNavigationBack();
  useEffect(() => { content.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' }); setSectionLanding(null); }, [navigationKey]);
  const title = sectionLanding || viewTitle || items.find(item => item.id === active)?.label || 'Робочий простір';
  const groups = ['Замовлення', 'Аналітика', 'Довідники', 'Дебіторка', 'Фотозвіт', 'Мій календар'] as const;
  const navigate = (item: NavigationItem) => { setSectionLanding(null); setMenuOpen(false); item.onClick(); };
  const openSection = (group: string) => { setMenuOpen(false); setSectionLanding(group); setExpanded(null); };
  const goHome = () => { setSectionLanding(null); items.find(item => item.id === 'home')?.onClick(); };
  useEffect(() => {
    if (updateState !== 'current') return;
    const timer = window.setTimeout(() => { setUpdateMessage(''); setUpdateState('idle'); }, 3000);
    return () => window.clearTimeout(timer);
  }, [updateState]);

  return <div className={styles.shell}>
    <a href="#soda-main" className={styles.skipLink}>Перейти до вмісту</a>
    <header className={styles.topbar}>
      {(back || active !== 'home' || sectionLanding) && <nav className={styles.returnNavigation} aria-label="Повернення">
        <button type="button" className={styles.back} onClick={sectionLanding ? () => setSectionLanding(null) : back?.onBack ?? goHome} aria-label="Назад" title="Назад"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg><span>Назад</span></button>
        <button type="button" className={styles.back} onClick={goHome} aria-label="Головна" title="Головна"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7v11h-6v-7H9v7H3Z" /></svg><span>Головна</span></button>
      </nav>}
      <div className={styles.heading}><strong>{title}</strong><small>{tenant ? tenant.toUpperCase() : 'SODA'}</small></div>
      {photoPercent !== null && <span className={styles.photoProgress} role="status">Фото {photoPercent}% <progress max={100} value={photoPercent}/></span>}
      <div className={styles.toolbar}>{!back && <ThemeSwitcher />}<button type="button" className={styles.menuButton} onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="soda-section-menu">☰ Меню</button></div>
    </header>
    {menuOpen && <nav id="soda-section-menu" className={styles.sectionMenu} aria-label="Меню SODA">
      <button type="button" className={styles.menuLink} onClick={() => navigate(items[0])}>⌂ Головна</button>
      {groups.map(group => {
        const entries = items.filter(item => item.group === group);
        const placeholder = false;
        const direct = group === 'Замовлення' || group === 'Мій календар' || group === 'Довідники' || group === 'Дебіторка';
        return <div key={group} className={styles.menuGroup}>
          <button type="button" className={styles.menuLink} onClick={() => direct && entries.length === 1 ? navigate(entries[0]) : openSection(group)} aria-current={sectionLanding === group ? 'page' : undefined}>
            {group} {!direct && <span aria-hidden="true">{expanded === group ? '⌃' : '⌄'}</span>}
          </button>
          {!direct && expanded === group && <div className={styles.menuChildren}>
            {placeholder && <span className={styles.menuMuted}>У розробці</span>}
            {!placeholder && entries.map(item => <button type="button" key={item.id} className={styles.menuChild} onClick={() => navigate(item)}>{item.label}</button>)}
            {!placeholder && !entries.length && <span className={styles.menuMuted}>Немає доступних підрозділів</span>}
          </div>}
        </div>;
      })}
      <div className={styles.menuGroup} onClick={() => setMenuOpen(false)}>{account}</div>
      <div className={styles.menuUpdate}>
        <button type="button" className={styles.menuLink} disabled={updateState === 'checking'} aria-busy={updateState === 'checking'} onClick={() => void handleRefreshApp()}>
          {updateState === 'checking' ? 'Перевірка…' : updateAvailable ? 'Встановити оновлення' : 'Перевірити оновлення'}
        </button>
        {updateMessage && <span role="status" aria-live="polite">{updateMessage}</span>}
      </div>
      <div className={styles.menuVersion}>SODA · v{__APP_VERSION__}</div>
    </nav>}
    <main id="soda-main" ref={content} tabIndex={-1} className={styles.content}>{sectionLanding ? <section className={styles.sectionLanding}>
      <h1>{sectionLanding}</h1>
      {items.filter(item => item.group === sectionLanding).length ? <div className={styles.sectionEntries}>
        {items.filter(item => item.group === sectionLanding).map(item => <button type="button" key={item.id} onClick={() => navigate(item)}>{item.label}</button>)}
      </div> : <p>У цьому розділі поки немає доступних сторінок.</p>}
    </section> : children}</main>
    {confirmUpdate && <AppDialog title="Встановити оновлення?" message="SODA завантажить нову версію. Незбережені дані форми можуть бути втрачені." onClose={() => setConfirmUpdate(false)} onConfirm={() => void handleRefreshApp(true)} confirmLabel="Оновити" />}
  </div>;
}
