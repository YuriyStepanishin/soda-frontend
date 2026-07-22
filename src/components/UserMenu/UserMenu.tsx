import styles from './UserMenu.module.css';
import LoginPage from '../LoginPage/LoginPage';
import LoginAppPage from '../LoginAppPage/LoginAppPage';

interface Props {
  email: string | null;
  roleLabel?: string;
  departmentLabel?: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLogin: (email: string) => void;
  onLogout: () => void;
}

export default function UserMenu({
  email,
  roleLabel,
  departmentLabel,
  isOpen,
  onOpen,
  onClose,
  onLogin,
  onLogout,
}: Props) {
  const userLabel = email?.trim().charAt(0).toUpperCase() || '';

  return (
    <>
      <div className={styles.anchor}>
        <button
          className={styles.trigger}
          onClick={isOpen ? onClose : onOpen}
          aria-label={email ? 'Відкрити меню користувача' : 'Відкрити вхід'}
          aria-expanded={isOpen}
        >
          {email ? (
            <span className={styles.avatarText}>{userLabel}</span>
          ) : (
            <svg
              className={styles.avatarIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 1 1 14 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {isOpen && (
        <>
          <button
            className={styles.backdrop}
            onClick={onClose}
            aria-label="Закрити меню користувача"
          />

          <div className={styles.panel}>
            {email ? (
              <LoginAppPage
                embedded
                email={email}
                roleLabel={roleLabel}
                departmentLabel={departmentLabel}
                onLogout={onLogout}
                onOk={onClose}
                okLabel="Закрити"
              />
            ) : (
              <LoginPage embedded onSuccess={onLogin} />
            )}
          </div>
        </>
      )}
    </>
  );
}
