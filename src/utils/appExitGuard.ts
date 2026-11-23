// App screens are stateful, so native Back must visit their previous step before
// leaving the document. Keep one same-URL history guard, never one per render.
const GUARD = 'sodaNavigationGuard';
type GuardOptions = { onBack: () => boolean; confirmExit: () => boolean | Promise<boolean> };

export function installAppExitGuard({ onBack, confirmExit }: GuardOptions) {
  const { history } = window;
  let leaving = false;
  let disposed = false;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  if (history.state?.[GUARD] !== 'active') {
    history.replaceState({ ...history.state, [GUARD]: 'root' }, '');
    history.pushState({ ...history.state, [GUARD]: 'active' }, '');
  }

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (leaving) return;
    event.preventDefault();
    event.returnValue = true;
  };
  const popState = (event: PopStateEvent) => {
    if (leaving || event.state?.[GUARD] !== 'root') return;
    if (onBack()) { history.forward(); return; }
    const decision = confirmExit();
    const leave = () => {
      leaving = true;
      history.back();
      resumeTimer = setTimeout(() => { leaving = false; }, 1000);
    };
    if (typeof decision === 'boolean') {
      if (!decision) history.forward();
      else leave();
      return;
    }
    // An in-app confirmation is async. Restore the protected state while open.
    history.forward();
    void decision.then(confirmed => {
      if (!confirmed || disposed) return;
      leaving = true;
      // From restored 'active', cross both guard entries to exit once.
      history.go(-2);
      resumeTimer = setTimeout(() => { leaving = false; }, 1000);
    }).catch(() => undefined);
  };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('popstate', popState);
  return () => {
    disposed = true;
    clearTimeout(resumeTimer);
    window.removeEventListener('beforeunload', beforeUnload);
    window.removeEventListener('popstate', popState);
  };
}
