import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, PackageSearch } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCart } from '@/context/CartContext';
import ReceiptLayout from '@/shared/components/ReceiptLayout';

import { useOrder } from '../hooks/useOrder';
import { clearShipping } from '../lib/shippingStorage';
import { isPaidStatus, isUuid } from '../services/checkoutService';

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 p-4 pt-16 font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
        {children}
      </div>
    </div>
  );
}

function Notice({ icon, title, children, spin = false }) {
  return (
    <Shell>
      <div
        className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 ${
          spin ? 'animate-pulse' : ''
        }`}
      >
        {icon}
      </div>
      <h1 className="text-lg font-black text-gray-900">{title}</h1>
      <div className="mt-2 text-xs text-gray-500">{children}</div>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/orders"
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          My orders
        </Link>
        <Link
          to="/"
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          Continue shopping
        </Link>
      </div>
    </Shell>
  );
}

/**
 * Where Stripe sends the customer after paying: /order/success?order=<id>.
 * The page trusts only the database. The payment confirmation can arrive a few seconds after
 * the customer does, so it waits briefly; the cart is emptied only once the order is really paid.
 */
export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const validId = isUuid(orderId);
  const { order, query, timedOut } = useOrder(validId ? orderId : null);
  const { removePurchasedLines } = useCart();
  const queryClient = useQueryClient();
  const cleaned = useRef(false);

  const paid = Boolean(order && isPaidStatus(order.status));

  useEffect(() => {
    if (!paid || cleaned.current) return;
    cleaned.current = true;
    removePurchasedLines(order.items);
    clearShipping();
    // Stock changed, so product pages must not show the old numbers.
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  }, [paid, order, removePurchasedLines, queryClient]);

  if (!validId || order === null) {
    return (
      <Notice
        icon={<PackageSearch size={28} aria-hidden="true" />}
        title="We couldn't find that order"
      >
        <p>Check My orders for your purchases.</p>
      </Notice>
    );
  }
  if (query.isError) {
    return (
      <Notice
        icon={<PackageSearch size={28} aria-hidden="true" />}
        title="We couldn't load your order"
      >
        <p>
          If you were charged, your order is safe. Please check My orders in a moment.{' '}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="cursor-pointer font-bold text-blue-600 underline"
          >
            Try again
          </button>
        </p>
      </Notice>
    );
  }
  if (!order) {
    return (
      <Notice icon={<Loader2 size={28} aria-hidden="true" />} title="Loading your order…" spin>
        <p>One moment.</p>
      </Notice>
    );
  }
  if (order.status === 'cancelled') {
    return (
      <Notice
        icon={<PackageSearch size={28} aria-hidden="true" />}
        title="This order was cancelled"
      >
        <p>No payment was taken for it. Your cart is unchanged.</p>
      </Notice>
    );
  }
  if (!paid) {
    return timedOut ? (
      <Notice
        icon={<Loader2 size={28} aria-hidden="true" />}
        title="Your payment is still being confirmed"
      >
        <p>
          This is taking longer than usual. You don&apos;t need to pay again: your order{' '}
          <strong>{order.orderNumber}</strong> will update in My orders as soon as the payment is
          confirmed.
        </p>
      </Notice>
    ) : (
      <Notice icon={<Loader2 size={28} aria-hidden="true" />} title="Confirming your payment…" spin>
        <p role="status">Please keep this page open for a few seconds.</p>
      </Notice>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={32} aria-hidden="true" />
            </div>
            <h1 className="text-xl font-black text-gray-900">Payment received</h1>
            <p className="mt-1 text-xs text-gray-500">
              Thank you! Order <strong className="text-gray-900">{order.orderNumber}</strong> is
              confirmed.
            </p>
          </div>

          <div className="mt-6">
            <ReceiptLayout order={order} totalLabel="Total paid" />
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/orders"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              My orders
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
    </div>
  );
}
