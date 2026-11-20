import { createContext } from 'react';

/** Holds the toast functions. `null` when no ToastProvider is mounted. */
export const ToastContext = createContext(null);
