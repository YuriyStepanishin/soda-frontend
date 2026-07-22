import { useEffect, useState } from 'react';

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
      onClick={() => prompt.prompt()}
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        padding: '10px 15px',
        fontSize: '16px',
        borderRadius: '10px',
        border: 'none',
        background: '#000',
        color: '#fff',
        zIndex: 9999,
      }}
    >
      Встановити додаток
    </button>
  );
}
