// App screens are stateful, so native Back must visit their previous step before
// leaving the document. Keep one same-URL history guard, never one per render.
const GUARD = 'sodaNavigationGuard';
type GuardOptions = { onBack: () => boolean; confirmExit: () => boolean };

export function installAppExitGuard({ onBack, confirmExit }: GuardOptions) {
  const { history } = window;
  let leaving = false;
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
    if (onBack() || !confirmExit()) {
      history.forward();
      return;
    }
    // The user already confirmed this history exit; avoid a second prompt.
    leaving = true;
    history.back();
    // Some installed-app browsers cannot close their initial history entry.
    // Keep protection if the document is still open after the attempted exit.
    resumeTimer = setTimeout(() => { leaving = false; }, 1000);
  };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('popstate', popState);
  return () => {
    clearTimeout(resumeTimer);
    window.removeEventListener('beforeunload', beforeUnload);
    window.removeEventListener('popstate', popState);
  };
}
