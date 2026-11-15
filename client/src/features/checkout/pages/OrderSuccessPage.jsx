import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, PackageSearch } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCart } from '@/context/CartContext';
import ProductImage from '@/features/catalog/components/ProductImage';
import { formatMoney } from '@/shared/lib/formatMoney';

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

  const { shipping } = order;
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

          <ul className="mt-6 divide-y divide-gray-100 border-t border-gray-100">
            {order.items.map((item) => (
              <li
                key={`${item.productId}|${item.size ?? ''}|${item.color ?? ''}`}
                className="flex items-center justify-between gap-3 py-3 text-xs"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProductImage
                    src={item.imageUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded border border-gray-100 bg-gray-50 object-contain p-1"
                  />
                  <div className="min-w-0">
                    <span className="block truncate font-bold text-gray-900">{item.title}</span>
                    <span className="text-[11px] text-gray-500">
                      {[item.color, item.size].filter(Boolean).join(' / ')}
                      {item.color || item.size ? ' · ' : ''}Qty {item.quantity}
                    </span>
                  </div>
                </div>
                <span className="font-bold text-gray-900">
                  {formatMoney(item.lineTotalMinor, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-gray-100 pt-4 text-xs">
            <div className="flex justify-between text-gray-500">
              <dt>Subtotal</dt>
              <dd className="font-bold text-gray-900">
                {formatMoney(order.subtotalMinor, order.currency)}
              </dd>
            </div>
            {order.discountMinor > 0 && (
              <div className="flex justify-between text-gray-500">
                <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                <dd className="font-bold text-emerald-600">
                  -{formatMoney(order.discountMinor, order.currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <dt>Delivery</dt>
              <dd className="font-bold text-gray-900">
                {order.deliveryFeeMinor === 0
                  ? 'Free'
                  : formatMoney(order.deliveryFeeMinor, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-black text-gray-900">
              <dt>Total paid</dt>
              <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-xs text-gray-600">
            <p className="mb-1 font-bold text-gray-900">Delivering to</p>
            <p>{shipping.name}</p>
            <p>{shipping.address}</p>
            <p>
              {shipping.city}, {shipping.state}
            </p>
            <p>{shipping.phone}</p>
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
