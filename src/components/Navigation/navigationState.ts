import { createContext } from 'react';

export type BackAction = { onBack: () => void; label: string };
export type NavigationControl = { register: (action: BackAction) => () => void };
export const RegistrationContext = createContext<NavigationControl | null>(null);
export const BackContext = createContext<BackAction | null>(null);

