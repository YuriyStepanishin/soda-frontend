import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RegistrationContext, BackContext, type BackAction, type NavigationControl } from './navigationState';
import { installAppExitGuard } from '../../utils/appExitGuard';
import AppDialog from './AppDialog';

export function NavigationProvider({ children, onBack, hasBack, enabled }: { children: ReactNode; onBack: () => void; hasBack: boolean; enabled: boolean }) {
  const actionRef = useRef<BackAction | null>(null);
  const fallbackRef = useRef({ onBack, hasBack });
  useLayoutEffect(() => { fallbackRef.current = { onBack, hasBack }; });
  const [label, setLabel] = useState<string | null>(null);
  const [exitRequested, setExitRequested] = useState(false);
  const pendingExit = useRef<((confirmed: boolean) => void) | null>(null);
  const completeExit = (confirmed: boolean) => {
    setExitRequested(false);
    pendingExit.current?.(confirmed);
    pendingExit.current = null;
  };
  const registration = useMemo<NavigationControl>(() => ({
    register(action) {
      actionRef.current = action;
      setLabel(action.label);
      return () => { actionRef.current = null; setLabel(null); };
    },
  }), []);
  const runBack = useCallback(() => {
    if (actionRef.current) actionRef.current.onBack();
    else fallbackRef.current.onBack();
  }, []);
  useEffect(() => {
    if (!enabled) return;
    return installAppExitGuard({
      onBack: () => {
        const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
        if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return true; }
        // Legacy report viewers also close before leaving their underlying page.
        const close = [...document.querySelectorAll<HTMLButtonElement>('[data-navigation-close]')].at(-1);
        if (close) { close.click(); return true; }
        if (fallbackRef.current.hasBack || actionRef.current) { runBack(); return true; }
        return false;
      },
      confirmExit: () => new Promise<boolean>(resolve => { pendingExit.current = resolve; setExitRequested(true); }),
    });
  }, [enabled, runBack]);
  const back = useMemo(() => hasBack || label ? { onBack: runBack, label: label || 'Назад' } : null, [hasBack, label, runBack]);
  return <RegistrationContext.Provider value={registration}><BackContext.Provider value={back}>
    {children}
    {exitRequested && <AppDialog title="Закрити SODA?" message="Незбережені зміни можуть бути втрачені." onClose={() => completeExit(false)} onConfirm={() => completeExit(true)} confirmLabel="Закрити SODA" destructive />}
  </BackContext.Provider></RegistrationContext.Provider>;
}

