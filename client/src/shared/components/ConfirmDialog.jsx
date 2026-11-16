import { useEffect, useRef } from 'react';

/**
 * A small "are you sure?" box. Escape or the backdrop cancels; focus starts on Cancel so a
 * stray Enter does not confirm.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {import('react').ReactNode} props.children
 * @param {string} props.confirmLabel
 * @param {boolean} [props.danger]
 * @param {boolean} [props.busy]
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-title" className="text-base font-black text-gray-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-gray-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
