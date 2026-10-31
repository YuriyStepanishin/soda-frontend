import styles from './LoginAppPage.module.css';

interface Props {
  email: string;
  roleLabel?: string;
  departmentLabel?: string;

  activeDatabase: string;

  canSwitchDatabase: boolean;
  onSelectDatabase: (tenantId: string) => void;

  onLogout: () => void;

  onOk: () => void;
  okLabel?: string;
  embedded?: boolean;
}

const TENANTS = [
  { id: 'olgatorg', name: 'OLGATORG' },
  { id: 'laska', name: 'LASKA' },
];

export default function LoginAppPage({
  email,
  roleLabel,
  departmentLabel,

  activeDatabase,

  canSwitchDatabase,
  onSelectDatabase,

  onLogout,

  onOk,
  okLabel = 'Далі',
  embedded = false,
}: Props) {
  const content = (
    <div className={`${styles.card} ${embedded ? styles.embeddedCard : ''}`}>
      <h2>Вітаю 👋</h2>

      <div>
        <span className={styles.email}>Ви увійшли як:</span>

        <div className={styles.email}>{email}</div>

        {roleLabel ? (
          <div className={styles.email}>Роль: {roleLabel}</div>
        ) : null}

        {departmentLabel ? (
          <div className={styles.email}>Відділ: {departmentLabel}</div>
        ) : null}
      </div>

      {/* БАЗА ДЛЯ РОБОТИ */}
      <div className={styles.database}>
        <span>Компанія:</span>

        {canSwitchDatabase ? (
          <select
            className={styles.databaseSelect}
            value={activeDatabase}
            onChange={event => onSelectDatabase(event.target.value)}
          >
            <option value="" disabled>Оберіть компанію для входу</option>
            {TENANTS.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        ) : (
          <strong>
            {TENANTS.find(tenant => tenant.id === activeDatabase)?.name ??
              activeDatabase}
          </strong>
        )}
      </div>

      <div className={styles.info}>
        <button className={styles.ok} onClick={onOk} disabled={!activeDatabase}>
          {okLabel}
        </button>

        <button className={styles.logout} onClick={onLogout}>
          Вийти
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <div className={styles.wrapper}>{content}</div>;
}
