import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { cancelOrder, isUuid } from '../services/checkoutService';

/**
 * Where Stripe sends the customer if they leave the payment page: /order/cancelled?order=<id>.
 * The unpaid order is cancelled in the database so its stock and coupon are given back.
 * The cart is untouched, so they can simply try again.
 */
export default function OrderCancelledPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const queryClient = useQueryClient();
  const started = useRef(false);

  const cancel = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const { mutate } = cancel;

  useEffect(() => {
    if (started.current || !isUuid(orderId)) return;
    started.current = true; // once only, even if the page renders twice
    mutate(orderId);
  }, [orderId, mutate]);

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 pt-16 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <XCircle size={28} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-black text-gray-900">Payment cancelled</h1>
        <p className="mt-2 text-xs text-gray-500">
          You were not charged, and your items are still in your cart.
        </p>

        {cancel.isPending && (
          <p role="status" className="mt-3 text-[11px] text-gray-400">
            Releasing your order…
          </p>
        )}
        {cancel.isError && (
          <p role="alert" className="mt-3 text-[11px] text-gray-500">
            We couldn&apos;t release the order right now. It will be released automatically within
            about half an hour.
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/checkout"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Back to checkout
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
