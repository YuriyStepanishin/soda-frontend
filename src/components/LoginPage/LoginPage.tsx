import { useState } from 'react';
import styles from './LoginPage.module.css';
import { login } from '../../api/auth';

interface Props {
  onSuccess: (email: string) => void;
  embedded?: boolean;
}

export default function LoginPage({ onSuccess, embedded = false }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setError('Вкажіть email і пароль');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const session = await login(normalizedEmail, password);
      onSuccess(session.email);
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : 'Помилка авторизації';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className={`${styles.card} ${embedded ? styles.embeddedCard : ''}`}>
      {embedded && <h3 className={styles.panelTitle}>Вхід в акаунт</h3>}

      <input
        className={styles.input}
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="email"
      />

      <input
        className={styles.input}
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Пароль"
        autoComplete="current-password"
      />

      <button
        className={styles.button}
        onClick={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? 'Вхід...' : 'Увійти'}
      </button>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );

  if (embedded) {
    return content;
  }

  return <div className={styles.wrapper}>{content}</div>;
}
