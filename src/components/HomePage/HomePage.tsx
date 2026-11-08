import DateTime from '../DateTime/DateTime';

import styles from './HomePage.module.css';

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  visible: boolean;
  badge?: number | null;
};

interface Props {
  onOpenDisplay: () => void;
  onOpenBonus: () => void;
  onOpenGallery: () => void;
  onOpenSales: () => void;
  onOpenSalesByDays: () => void;
  onOpenRouteHistory: () => void;
  activeDatabase: string;
  onOpenMotivation: () => void;
  canOpenMotivation: boolean;

  onOpenActiveCustomerBase: () => void;
  onOpenImplementation: () => void;
  onOpenStoreCheck: () => void;
  onOpenStoreCheckReview: () => void;
  onOpenMessages: () => void;
  unreadMessagesCount: number;
  onOpenPlanTargets: () => void;
  canOpenPlanTargets: boolean;
  canOpenDisplayReport: boolean;
  canOpenBonusReport: boolean;
  canOpenGallery: boolean;
  canOpenSales: boolean;
  canOpenSalesByDays: boolean;
  canOpenRouteHistory: boolean;

  canOpenActiveCustomerBase: boolean;
  canOpenImplementation: boolean;
  canOpenMessages: boolean;
  canOpenStoreCheck: boolean;
  canOpenStoreCheckReview: boolean;
}

export default function HomePage({
  onOpenDisplay,
  onOpenBonus,
  onOpenGallery,
  onOpenSales,
  onOpenSalesByDays,
  onOpenRouteHistory,
  activeDatabase,
  onOpenMotivation,
  canOpenMotivation,

  onOpenActiveCustomerBase,
  onOpenImplementation,
  onOpenStoreCheck,
  onOpenStoreCheckReview,
  onOpenMessages,
  unreadMessagesCount,
  onOpenPlanTargets,
  canOpenPlanTargets,
  canOpenDisplayReport,
  canOpenBonusReport,
  canOpenGallery,
  canOpenSales,
  canOpenSalesByDays,
  canOpenRouteHistory,

  canOpenActiveCustomerBase,
  canOpenImplementation,
  canOpenMessages,
  canOpenStoreCheck,
  canOpenStoreCheckReview,
}: Props) {
  const withVersion = (iconPath: string) => `${iconPath}?v=${__APP_VERSION__}`;

  const handleRefreshApp = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    }
    window.location.reload();
  };

  const topMenuItems: MenuItem[] = [
    { key: 'motivation', label: 'Контроль мотивації', icon: withVersion('/icons/implementation.svg'), onClick: onOpenMotivation, visible: activeDatabase === 'laska' && canOpenMotivation },
    {
      key: 'sales',
      label: 'Продажі',
      icon: withVersion('/icons/chart-icon-64.svg'),
      onClick: onOpenSales,
      visible: canOpenSales,
    },
    {
      key: 'route-history',
      label: 'Історія продажів',
      icon: withVersion('/icons/ClientProduct.svg'),
      onClick: onOpenRouteHistory,
      visible: canOpenRouteHistory,
    },
    {
      key: 'gallery',
      label: 'Фотогалерея',
      icon: withVersion('/icons/gallery-icon-64.svg'),
      onClick: onOpenGallery,
      visible: activeDatabase === 'olgatorg' && canOpenGallery,
    },
    {
      key: 'sales-by-days',
      label: 'Продажі по днях',
      icon: withVersion('/icons/calendar-icon-64.svg'),
      onClick: onOpenSalesByDays,
      visible: canOpenSalesByDays,
    },
    {
      key: 'active-customer-base',
      label: 'Цілі маршрута',
      icon: withVersion('/icons/calendar-icon-64.svg'),
      onClick: onOpenActiveCustomerBase,
      visible: activeDatabase === 'olgatorg' && canOpenActiveCustomerBase,
    },
    {
      key: 'messages',
      label: 'Дошка інформації',
      icon: withVersion('/icons/message-icon-64.svg'),
      onClick: onOpenMessages,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      visible: activeDatabase === 'olgatorg' && canOpenMessages,
    },
    {
      key: 'implementation',
      label: 'Виконання показників',
      icon: withVersion('/icons/implementation.svg'),
      onClick: onOpenImplementation,
      visible: activeDatabase === 'olgatorg' && canOpenImplementation,
    },
    {
      key: 'store-check-review',
      label: 'Перегляд StoreCheck',
      icon: withVersion('/icons/storecheck.svg'),
      onClick: onOpenStoreCheckReview,
      visible: activeDatabase === 'olgatorg' && canOpenStoreCheckReview,
    },
    {
      key: 'plan-targets',
      label: 'Планові показники',
      icon: withVersion('/icons/icons_planning.svg'),
      onClick: onOpenPlanTargets,
      visible: activeDatabase === 'olgatorg' && canOpenPlanTargets,
    },
  ];

  const bottomMenuItems: MenuItem[] = [
    {
      key: 'bonus',
      label: 'Додавання фотозвіту',
      icon: withVersion('/icons/camera-icon-64.svg'),
      onClick: onOpenBonus,
      visible: activeDatabase === 'olgatorg' && canOpenBonusReport,
    },
    {
      key: 'display',
      label: 'Додавання фотозвіту для Акція на представленність',
      icon: withVersion('/icons/promo-icon-64.svg'),
      onClick: onOpenDisplay,
      visible: activeDatabase === 'olgatorg' && canOpenDisplayReport,
    },
    {
      key: 'store-check',
      label: 'Додавання StoreCheck',
      icon: withVersion('/icons/storecheck.svg'),
      onClick: onOpenStoreCheck,
      visible: activeDatabase === 'olgatorg' && canOpenStoreCheck,
    },
  ];

  const descriptions: Record<string, string> = {
    sales: 'Показники, фільтри та звіти', 'sales-by-days': 'Динаміка продажів і графіки',
    'route-history': 'Торгові точки та історія замовлень', motivation: 'Перевірки та результати команди',
    gallery: 'Фото та результати перевірок', messages: 'Повідомлення для команди',
  };
  return <main className={styles.container}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{activeDatabase ? activeDatabase.toUpperCase() : 'SODA'}</p></div><DateTime /></header>
    <section className={styles.grid} aria-label="Розділи SODA">{topMenuItems.filter(item => item.visible).map(item => <button type="button" key={item.key} onClick={item.onClick} className={styles.card}>
      <span className={styles.iconWrap}><img src={item.icon} alt="" width="28" height="28" /></span><span className={styles.cardCopy}><strong>{item.label}</strong><small>{descriptions[item.key] ?? 'Відкрити розділ'}</small></span>{item.badge ? <span className={styles.badge}>{item.badge}</span> : <span className={styles.arrow} aria-hidden="true">↗</span>}
    </button>)}</section>
    {bottomMenuItems.some(item => item.visible) && <section className={styles.photoSection}><h2>Фотозвіти та перевірки</h2><div className={styles.grid}>{bottomMenuItems.filter(item => item.visible).map(item => <button type="button" key={item.key} onClick={item.onClick} className={styles.card}><span className={styles.iconWrap}><img src={item.icon} alt="" width="28" height="28" /></span><span className={styles.cardCopy}><strong>{item.label}</strong></span><span className={styles.arrow} aria-hidden="true">↗</span></button>)}</div></section>}
    <footer className={styles.footer}><span>SODA · v{__APP_VERSION__}</span><button type="button" onClick={() => void handleRefreshApp()}>Оновити застосунок</button></footer>
  </main>;
}
