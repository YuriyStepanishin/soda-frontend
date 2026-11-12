import { useContext, useLayoutEffect, useRef } from 'react';
import { BackContext, RegistrationContext } from './navigationState';

export const useNavigationBack = () => useContext(BackContext);

// Page-specific Back actions (for example report -> parameters) use the shell's
// single button instead of adding another button to the document.
export function usePageBack(onBack: () => void, label: string) {
  const registration = useContext(RegistrationContext);
  const handler = useRef(onBack);
  useLayoutEffect(() => { handler.current = onBack; });
  useLayoutEffect(() => registration?.register({ onBack: () => handler.current(), label }), [registration, label]);
  return registration !== null;
}
