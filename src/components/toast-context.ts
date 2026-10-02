import { createContext } from 'react';

export interface ToastMessage {
  kind: 'success' | 'error';
  message: string;
}

export const ToastContext = createContext<(toast: ToastMessage) => void>(() => undefined);
