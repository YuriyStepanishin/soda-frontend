import { useSyncExternalStore } from 'react';
import { applyTheme, currentTheme, subscribeTheme } from '../../theme/theme';
import styles from './AppShell.module.css';
export default function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light');
  return <div className={styles.themeSwitch} role="group" aria-label="Тема оформлення">
    <button type="button" aria-label="Світла тема" aria-pressed={theme === 'light'} onClick={() => applyTheme('light')} title="Світла тема"><span aria-hidden="true">☀</span><span className={styles.themeLabel}>Світла</span></button>
    <button type="button" aria-label="Темна тема" aria-pressed={theme === 'dark'} onClick={() => applyTheme('dark')} title="Темна тема"><span aria-hidden="true">☾</span><span className={styles.themeLabel}>Темна</span></button>
  </div>;
}
