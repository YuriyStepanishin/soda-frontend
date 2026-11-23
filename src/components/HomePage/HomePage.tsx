import { useState, type ReactNode } from 'react';
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
  onOpenPhotoReports: () => void;
  onOpenLaskaGallery: () => void;
  onOpenDictionaries: () => void;
  canOpenDictionaries: boolean;
  onOpenSales: () => void;
  onOpenSalesByDays: () => void;
  onOpenRouteHistory: () => void;
  activeDatabase: string;
  onOpenMotivation: () => void;
  canOpenMotivation: boolean;
  onOpenReceivables: () => void;
  canOpenReceivables: boolean;

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
  canOpenPhotoReports: boolean;
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
  onOpenPhotoReports,
  onOpenLaskaGallery,
  onOpenDictionaries,
  canOpenDictionaries,
  onOpenSales,
  onOpenSalesByDays,
  onOpenRouteHistory,
  activeDatabase,
  onOpenMotivation,
  canOpenMotivation,
  onOpenReceivables,
  canOpenReceivables,

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
  canOpenPhotoReports,
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
  const [section, setSection] = useState<'home' | 'analytics' | 'photos' | 'orders' | 'calendar'>('home');

  const iconPaths: Record<string, ReactNode> = {
    dictionaries: (
      <>
        <rect x="3" y="4" width="8" height="16" rx="1" />
        <rect x="13" y="4" width="8" height="16" rx="1" />
        <path d="M5 8h4M15 8h4M5 12h4M15 12h4" />
      </>
    ),
    receivables: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 10h18M7 3v4M17 3v4M7 15h4M15 15h2" />
      </>
    ),
    motivation: (
      <>
        <path d="m3 17 6-6 4 4 8-9" />
        <path d="M15 6h6v6" />
      </>
    ),
    sales: (
      <>
        <path d="M4 20V12M10 20V7M16 20v-5M22 20V3" />
      </>
    ),
    'route-history': (
      <>
        <path d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M9 16h5a4 4 0 0 0 4-4v-2" />
      </>
    ),
    gallery: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 6-6 4 4 3-3 5 5" />
      </>
    ),
    'sales-by-days': (
      <>
        <path d="M3 3v18h18M7 15l4-5 4 3 5-7" />
      </>
    ),
    'active-customer-base': (
      <>
        <path d="M4 20V5h16v15M8 9h8M8 13h8M8 17h5" />
      </>
    ),
    messages: (
      <>
        <path d="M4 4h16v13H8l-4 4zM8 9h8M8 13h5" />
      </>
    ),
    implementation: (
      <>
        <path d="M4 20V4h16M8 15l4-4 3 2 5-7" />
      </>
    ),
    'store-check-review': (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M8 12l3 3 5-6" />
      </>
    ),
    'plan-targets': (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    bonus: (
      <>
        <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    display: (
      <>
        <path d="m3 11 13-6v14L3 14zM7 15l2 6h4l-2-5M16 10h4" />
      </>
    ),
    'store-check': (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M8 12l3 3 5-6" />
      </>
    ),
  };
  const renderIcon = (key: string) => (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[key] ?? iconPaths.dictionaries}
    </svg>
  );

  const topMenuItems: MenuItem[] = [
    {
      key: 'dictionaries',
      label: 'Довідники',
      icon: withVersion('/icons/ClientProduct.svg'),
      onClick: onOpenDictionaries,
      visible: canOpenDictionaries,
    },
    {
      key: 'receivables',
      label: 'Дебіторка',
      icon: withVersion('/icons/calendar-icon-64.svg'),
      onClick: onOpenReceivables,
      visible: canOpenReceivables,
    },
    {
      key: 'motivation',
      label: 'Контроль мотивації',
      icon: withVersion('/icons/implementation.svg'),
      onClick: onOpenMotivation,
      visible: activeDatabase === 'laska' && canOpenMotivation,
    },
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
      label: 'Галерея',
      icon: withVersion('/icons/gallery-icon-64.svg'),
      onClick: activeDatabase === 'laska' ? onOpenLaskaGallery : onOpenGallery,
      visible: activeDatabase === 'laska'
        ? canOpenPhotoReports
        : activeDatabase === 'olgatorg' && canOpenGallery,
    },
    {
      key: 'photo-report',
      label: 'Фотозвіт',
      icon: withVersion('/icons/gallery-icon-64.svg'),
      onClick: onOpenPhotoReports,
      visible: activeDatabase === 'laska' && canOpenPhotoReports,
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
      visible: (activeDatabase === 'olgatorg' || activeDatabase === 'laska') && canOpenPlanTargets,
    },
  ];

  const bottomMenuItems: MenuItem[] = [
    { key: 'bonus', label: 'Фотозвіт', icon: withVersion('/icons/camera-icon-64.svg'), onClick: onOpenPhotoReports, visible: activeDatabase === 'laska' && canOpenPhotoReports },
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
    sales: 'Показники, фільтри та звіти',
    'sales-by-days': 'Динаміка продажів і графіки',
    'route-history': 'Торгові точки та історія замовлень',
    motivation: 'Перевірки та результати команди',
    gallery: 'Фото та результати перевірок',
    messages: 'Повідомлення для команди',
  };
  return (
    <main className={styles.container}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            {activeDatabase ? activeDatabase.toUpperCase() : 'SODA'}
          </p>
        </div>
        <DateTime />
      </header>
      {section === 'home' ? (
        <section className={styles.grid} aria-label="П'ять розділів SODA">
          {([
            ['orders', 'Замовлення', 'У розробці'],
            ['analytics', 'Аналітика', 'Продажі, звіти та показники'],
            ['dictionaries', 'Довідники', 'Товари, маршрути, обладнання і прайс'],
            ['receivables', 'Дебіторка', 'Заборгованість та накладні'],
            ['photos', 'Фотозвіт', 'Створення, галерея та перевірки'],
            ['calendar', 'Мій календар', 'У розробці'],
          ] as const).map(([key, label, description]) => (
            <button key={key} type="button" className={styles.card}
              disabled={key === 'receivables' && !canOpenReceivables}
              onClick={() => {
                setSection('home');
                if (key === 'receivables') onOpenReceivables();
                else if (key === 'dictionaries') onOpenDictionaries();
                else window.dispatchEvent(new CustomEvent('soda:open-section', { detail: ({ analytics: 'Аналітика', photos: 'Фотозвіт', orders: 'Замовлення', calendar: 'Мій календар' } as Record<string,string>)[key] }));
              }}>
              <span className={styles.iconWrap}>{renderIcon(key === 'receivables' ? 'receivables' : key === 'dictionaries' ? 'dictionaries' : key === 'photos' ? 'gallery' : key === 'analytics' ? 'sales' : key === 'calendar' ? 'sales-by-days' : 'dictionaries')}</span>
              <span className={styles.cardCopy}><strong>{label}</strong><small>{description}</small></span>
              <span className={styles.arrow} aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      ) : (
        <section className={styles.subsection} aria-label="Підрозділи SODA">
          <div className={styles.sectionHeader}>
            
            <h2>{section === 'analytics' ? 'Аналітика' : section === 'photos' ? 'Фотозвіт' : section === 'orders' ? 'Замовлення' : 'Мій календар'}</h2>
          </div>
          {(section === 'orders' || section === 'calendar') ? <p className={styles.placeholder}>У розробці</p> : (
            <div className={styles.grid}>
              {(section === 'analytics'
                ? topMenuItems.filter(item => item.visible && item.key !== 'receivables' && item.key !== 'dictionaries' && item.key !== 'gallery' && item.key !== 'photo-report')
                : [...topMenuItems.filter(item => item.visible && (item.key === 'gallery' || item.key === 'photo-report')), ...bottomMenuItems.filter(item => item.visible && item.key !== 'bonus')]
              ).map((item, index) => (
                <button type="button" key={`${item.key}-${index}`} onClick={item.onClick} className={styles.card}>
                  <span className={styles.iconWrap}>{renderIcon(item.key)}</span>
                  <span className={styles.cardCopy}><strong>{item.label}</strong><small>{descriptions[item.key] ?? 'Відкрити розділ'}</small></span>
                  {item.badge ? <span className={styles.badge}>{item.badge}</span> : <span className={styles.arrow} aria-hidden="true">›</span>}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

    </main>
  );
}
