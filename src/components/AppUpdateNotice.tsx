import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function AppUpdateNotice() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const updateSW = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const apply = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (!disposed) setUpdateReady(true);
      },
      onRegisteredSW(_swUrl, swRegistration) {
        registration = swRegistration;
        void check();
      },
      onRegisterError(error) {
        console.error('SODA: не вдалося зареєструвати оновлення', error);
      },
    });
    updateSW.current = apply;

    async function check() {
      if (disposed || !navigator.onLine || !registration) return;
      try {
        await registration.update();
      } catch (error) {
        console.warn('SODA: перевірка оновлень не вдалася', error);
      }
    }

    const timer = window.setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    const onOnline = () => { void check(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      maxWidth: 460, margin: '0 auto', padding: 16, borderRadius: 14,
      background: '#102743', color: '#fff', boxShadow: '0 6px 28px #0006',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ flex: '1 1 190px' }}>Оновлення SODA завантажено. Збережіть незавершену роботу перед перезапуском.</span>
      <button type="button" disabled={applying} onClick={() => {
        if (!updateSW.current) return;
        setApplying(true);
        void updateSW.current(true).catch(error => {
          console.error('SODA: не вдалося застосувати оновлення', error);
          setApplying(false);
        });
      }} style={{ padding: '10px 14px', borderRadius: 8, border: 0, fontWeight: 700 }}>
        {applying ? 'Оновлення…' : 'Оновити'}
      </button>
      <button type="button" onClick={() => setUpdateReady(false)}
        style={{ background: 'transparent', border: '1px solid #ffffff70', borderRadius: 8, color: '#fff', padding: '9px 12px' }}>
        Пізніше
      </button>
    </div>
  );
}
