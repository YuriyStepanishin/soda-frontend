import styles from './LoginAppPage.module.css';

interface Props {
  email: string;
  roleLabel?: string;
  departmentLabel?: string;

  onLogout: () => void;

  onOk: () => void;
  okLabel?: string;
  embedded?: boolean;
}

export default function LoginAppPage({
  email,
  roleLabel,
  departmentLabel,

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

      <div className={styles.info}>
        <button className={styles.ok} onClick={onOk}>
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
