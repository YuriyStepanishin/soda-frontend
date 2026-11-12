import { useEffect, useState } from 'react';
import styles from './InstallButton.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt) return null;

  return (
    <button
      onClick={async () => { await prompt.prompt(); setPrompt(null); }}
      type="button"
      className={styles.install}
    >
      Встановити додаток
    </button>
  );
}
