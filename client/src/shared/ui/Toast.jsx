import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ToastContext } from './toastContext';

const MAX_VISIBLE = 3;
const DURATION = { success: 5000, info: 5000, error: 8000 };

const VARIANTS = {
  success: { icon: CircleCheck, box: 'border-green-200 bg-green-50 text-green-800' },
  error: { icon: CircleAlert, box: 'border-red-200 bg-red-50 text-red-800' },
  info: { icon: Info, box: 'border-blue-200 bg-blue-50 text-blue-700' },
};

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const { icon: Icon, box } = VARIANTS[toast.variant];

  // Closes itself after a few seconds; hovering or focusing it holds it open.
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION[toast.variant]);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.variant, onDismiss]);

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg ${box}`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Mount once near the top of a part of the app (the admin layout, in Phase 2). Children call
 * `useToast()`. At most 3 toasts show at once.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((variant, message) => {
    nextId.current += 1;
    const toast = { id: nextId.current, variant, message };
    setToasts((current) => [...current, toast].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
