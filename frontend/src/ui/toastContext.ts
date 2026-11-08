import { createContext, useContext } from 'react';

/** Show a short message above the tab bar. A new message replaces the current one. */
export type ShowToast = (message: string, durationMs?: number) => void;

export const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
