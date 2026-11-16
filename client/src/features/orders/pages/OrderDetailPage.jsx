import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { isPaidStatus, isUuid } from '@/features/checkout/services/checkoutService';
import ReceiptLayout from '@/shared/components/ReceiptLayout';
import { formatDateTime } from '@/shared/lib/formatDate';

import CancelOrderButton from '../components/CancelOrderButton';
import StatusBadge from '../components/StatusBadge';
import { buildTimeline, cancelReasonText, isPast } from '../lib/orderStatus';
import { getOrderDetail } from '../services/orderService';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          to="/orders"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" /> My orders
        </Link>
        {children}
      </div>
    </div>
  );
}

function Timeline({ order }) {
  const steps = buildTimeline(order);
  return (
    <ol aria-label="Order status" className="space-y-3">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3 text-xs">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              step.done ? 'bg-emerald-500 text-white' : 'border border-gray-300 text-gray-300'
            }`}
          >
            {step.done ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <Circle size={8} aria-hidden="true" />
            )}
          </span>
          <div>
            <p className={step.done ? 'font-bold text-gray-900' : 'text-gray-400'}>
              {step.label}
              <span className="sr-only">{step.done ? ' (done)' : ' (not yet)'}</span>
            </p>
            {step.done && step.at && (
              <p className="text-[11px] text-gray-500">{formatDateTime(step.at)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One of the customer's orders: status timeline, items, totals, address and tracking. */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const valid = isUuid(orderId);
  const query = useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => getOrderDetail(orderId),
    enabled: valid,
    staleTime: 0,
  });
  const order = query.data;

  if (!valid || order === null) {
    return (
      <Shell>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
          <h1 className="text-lg font-black text-gray-900">We couldn&apos;t find that order</h1>
          <p className="mt-2 text-xs text-gray-500">
            It may not exist, or it may belong to another account.
          </p>
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-700">We couldn&apos;t load this order.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!order) {
    return (
      <Shell>
        <p role="status" className="py-16 text-center text-xs text-gray-500">
          Loading your order…
        </p>
      </Shell>
    );
  }

  const paid = isPaidStatus(order.status);
  const expired = Boolean(order.expiresAt) && isPast(order.expiresAt);

  return (
    <Shell>
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-gray-900">Order {order.orderNumber}</h1>
            <p className="mt-0.5 text-xs text-gray-500">Placed {formatDateTime(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {order.status === 'pending_payment' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="font-bold">This order has not been paid.</p>
            <p className="mt-1">
              {expired
                ? 'The payment time has run out. This order will be cancelled shortly.'
                : `This order will expire on ${formatDateTime(order.expiresAt)}.`}
            </p>
            <div className="mt-3">
              <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
            </div>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
            <p className="font-bold">Cancelled on {formatDateTime(order.cancelledAt)}</p>
            {cancelReasonText(order.cancelReason) && (
              <p className="mt-1">{cancelReasonText(order.cancelReason)}</p>
            )}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-900">Status</h2>
          <Timeline order={order} />
        </section>

        {paid && (order.shipping.courier || order.trackingNumber) && (
          <section className="rounded-xl bg-gray-50 p-4 text-xs text-gray-600">
            {order.shipping.courier && (
              <p>
                <span className="font-bold text-gray-900">Courier:</span> {order.shipping.courier}
              </p>
            )}
            {order.trackingNumber ? (
              <p>
                <span className="font-bold text-gray-900">Tracking number:</span>{' '}
                {order.trackingNumber}
              </p>
            ) : (
              <p className="text-gray-500">A tracking number will appear here once it ships.</p>
            )}
          </section>
        )}

        <ReceiptLayout order={order} totalLabel={paid ? 'Total paid' : 'Total'} />
      </div>
    </Shell>
  );
}
