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
  onOpenRouteHistory: () => void;
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
  onOpenRouteHistory,
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
    {
      key: 'sales',
      label: 'Продажі',
      icon: withVersion('/icons/chart-icon-64.svg'),
      onClick: onOpenSales,
      visible: canOpenSales,
    },
    {
      key: 'gallery',
      label: 'Фотогалерея',
      icon: withVersion('/icons/gallery-icon-64.svg'),
      onClick: onOpenGallery,
      visible: canOpenGallery,
    },
    {
      key: 'sales-by-days',
      label: 'Історія продажів',
      icon: withVersion('/icons/ClientProduct.svg'),
      onClick: onOpenRouteHistory,
      visible: canOpenRouteHistory,
    },
    {
      key: 'active-customer-base',
      label: 'Цілі маршрута',
      icon: withVersion('/icons/calendar-icon-64.svg'),
      onClick: onOpenActiveCustomerBase,
      visible: canOpenActiveCustomerBase,
    },
    {
      key: 'messages',
      label: 'Дошка інформації',
      icon: withVersion('/icons/message-icon-64.svg'),
      onClick: onOpenMessages,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      visible: canOpenMessages,
    },
    {
      key: 'implementation',
      label: 'Виконання показників',
      icon: withVersion('/icons/implementation.svg'),
      onClick: onOpenImplementation,
      visible: canOpenImplementation,
    },
    {
      key: 'store-check-review',
      label: 'Перегляд StoreCheck',
      icon: withVersion('/icons/storecheck.svg'),
      onClick: onOpenStoreCheckReview,
      visible: canOpenStoreCheckReview,
    },
    {
      key: 'plan-targets',
      label: 'Планові показники',
      icon: withVersion('/icons/icons_planning.svg'),
      onClick: onOpenPlanTargets,
      visible: canOpenPlanTargets,
    },
  ];

  const bottomMenuItems: MenuItem[] = [
    {
      key: 'bonus',
      label: 'Додавання фотозвіту',
      icon: withVersion('/icons/camera-icon-64.svg'),
      onClick: onOpenBonus,
      visible: canOpenBonusReport,
    },
    {
      key: 'display',
      label: 'Додавання фотозвіту для Акція на представленність',
      icon: withVersion('/icons/promo-icon-64.svg'),
      onClick: onOpenDisplay,
      visible: canOpenDisplayReport,
    },
    {
      key: 'store-check',
      label: 'Додавання StoreCheck',
      icon: withVersion('/icons/storecheck.svg'),
      onClick: onOpenStoreCheck,
      visible: canOpenStoreCheck,
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* фон */}
      <div className={styles.backgroundOverlay} aria-hidden="true" />

      <DateTime />

      <button
        type="button"
        className={styles.refreshButton}
        onClick={() => {
          void handleRefreshApp();
        }}
        aria-label="Оновити додаток"
        title="Оновити"
      >
        <span className={styles.refreshIcon} aria-hidden="true">
          ↻
        </span>
        <span className={styles.refreshText}>Оновити v{__APP_VERSION__}</span>
      </button>

      {/* навігація */}
      <div className={styles.buttonContainer}>
        <div className={styles.brandBlock}>
          <span className={styles.brandLogo}>S</span>
          <div className={styles.brandMeta}>
            <strong className={styles.brandName}>SODA</strong>
            <span className={styles.brandSub}>Головна панель</span>
          </div>
        </div>

        <p className={styles.sidebarTitle}>Розділи</p>
        <div className={styles.topGroup}>
          {topMenuItems
            .filter(item => item.visible)
            .map(item => (
              <button
                key={item.key}
                onClick={item.onClick}
                className={styles.button}
              >
                {item.badge ? (
                  <span className={styles.badge}>{item.badge}</span>
                ) : null}
                <span className={styles.iconWrap}>
                  <img src={item.icon} className={styles.icon} />
                </span>
                <span className={styles.menuLabel}>{item.label}</span>
              </button>
            ))}
        </div>

        <div className={styles.bottomGroup}>
          {bottomMenuItems
            .filter(item => item.visible)
            .map(item => (
              <button
                key={item.key}
                onClick={item.onClick}
                className={styles.button}
              >
                <span className={styles.iconWrap}>
                  <img src={item.icon} className={styles.icon} />
                </span>
                <span className={styles.menuLabel}>{item.label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
