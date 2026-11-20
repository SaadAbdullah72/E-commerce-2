import { useRef } from 'react';

import Button from '@/shared/ui/Button';
import Modal from '@/shared/ui/Modal';

/**
 * A small "are you sure?" box. Escape or the backdrop cancels; focus starts on Cancel so a
 * stray Enter does not confirm. Tab stays inside the box, the page behind does not scroll, and
 * focus returns to what opened it (all handled by Modal).
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

  return (
    <Modal
      title={title}
      size="sm"
      role="alertdialog"
      onClose={onCancel}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            loadingText="Working..."
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
