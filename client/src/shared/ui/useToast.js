import { useContext } from 'react';

import { ToastContext } from './toastContext';

const noop = () => {};
const NO_TOASTS = { success: noop, error: noop, info: noop, dismiss: noop };

/**
 * `const toast = useToast(); toast.success('Saved')`. Without a ToastProvider above it, the
 * functions do nothing, so a component that toasts still renders on its own (in tests, say).
 */
export function useToast() {
  return useContext(ToastContext) ?? NO_TOASTS;
}
