import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

const SIZES = { sm: 'max-w-[400px]', md: 'max-w-[500px]', lg: 'max-w-[700px]' };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A dialog. Mount it to open it, unmount it to close it. While it is open:
 * Escape or a click on the backdrop closes it, Tab stays inside it, the page behind does not
 * scroll, and focus goes back to what had it before when it closes.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {'sm' | 'md' | 'lg'} [props.size] 400, 500 or 700px wide
 * @param {'dialog' | 'alertdialog'} [props.role] alertdialog for "are you sure?" boxes
 * @param {() => void} props.onClose
 * @param {import('react').ReactNode} [props.footer] actions, right-aligned
 * @param {import('react').RefObject<HTMLElement | null>} [props.initialFocusRef] what gets focus first
 * @param {boolean} [props.hideClose] hide the X (alertdialog hides it by default)
 */
export default function Modal({
  title,
  size = 'md',
  role = 'dialog',
  onClose,
  footer,
  initialFocusRef,
  hideClose = role === 'alertdialog',
  children,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  // The latest onClose, so a new callback from the parent does not restart the effect below.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target = initialFocusRef?.current ?? panel.querySelector(FOCUSABLE) ?? panel;
    target.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
    // initialFocusRef is a ref object: it never changes, and the focus must only move on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-panel relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-xl bg-white shadow-xl focus:outline-none ${SIZES[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          {!hideClose && (
            <button
              type="button"
              onClick={() => onClose()}
              aria-label="Close"
              className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-gray-700">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-gray-200 bg-gray-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
