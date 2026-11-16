import { useState } from 'react';

import ConfirmDialog from '@/shared/components/ConfirmDialog';

import { useCancelOrder } from '../hooks/useCancelOrder';

/**
 * "Cancel order" with an "are you sure?" box. Only for unpaid orders: the order's items go back
 * in stock and nothing is charged.
 *
 * @param {object} props
 * @param {string} props.orderId
 * @param {string} props.orderNumber
 * @param {string} [props.className]
 */
export default function CancelOrderButton({ orderId, orderNumber, className = '' }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const cancel = useCancelOrder();

  const close = () => {
    if (cancel.isPending) return;
    setOpen(false);
    setMessage('');
  };

  const confirm = () => {
    setMessage('');
    cancel.mutate(orderId, {
      onSuccess: (cancelled) => {
        if (cancelled) setOpen(false);
        else
          setMessage('This order can no longer be cancelled. It may already be paid or cancelled.');
      },
      onError: (error) => setMessage(error.message),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-pointer rounded-xl border border-red-200 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 ${className}`}
      >
        Cancel order
      </button>

      {open && (
        <ConfirmDialog
          title="Cancel this order?"
          confirmLabel="Cancel order"
          danger
          busy={cancel.isPending}
          onConfirm={confirm}
          onCancel={close}
        >
          <p>
            Order <strong>{orderNumber}</strong> has not been paid. If you cancel it, the items are
            released and you will not be charged.
          </p>
          {message && (
            <p role="alert" className="mt-2 font-semibold text-red-600">
              {message}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
