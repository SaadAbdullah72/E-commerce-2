import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A full-screen box for a picture or video. Escape or the backdrop closes it, Tab stays inside it,
 * and focus goes back to whatever opened it.
 *
 * @param {{ label: string, onClose: () => void, children: import('react').ReactNode }} props
 */
export default function MediaModal({ label, onClose, children }) {
  const box = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeButton.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !box.current) return;
      const stops = [...box.current.querySelectorAll(FOCUSABLE)].filter((node) => !node.disabled);
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex max-h-full w-full max-w-3xl flex-col items-center"
      >
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="mb-2 cursor-pointer self-end rounded-full bg-white/90 p-1.5 text-gray-900 hover:bg-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}
