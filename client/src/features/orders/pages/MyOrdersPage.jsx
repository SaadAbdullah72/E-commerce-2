import { useInfiniteQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import ProductImage from '@/features/catalog/components/ProductImage';
import { formatDateTime } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';

import CancelOrderButton from '../components/CancelOrderButton';
import StatusBadge from '../components/StatusBadge';
import { canCancel, cancelReasonText } from '../lib/orderStatus';
import { listOrders } from '../services/orderService';

const THUMBNAILS_SHOWN = 4;

function OrderCard({ order }) {
  const extra = order.items.length - THUMBNAILS_SHOWN;
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/orders/${order.id}`}
            className="text-sm font-black text-gray-900 hover:text-blue-600"
          >
            {order.orderNumber}
          </Link>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {order.items.slice(0, THUMBNAILS_SHOWN).map((item, index) => (
          <ProductImage
            key={`${item.title}-${index}`}
            src={item.imageUrl}
            alt={item.title}
            className="h-12 w-12 shrink-0 rounded border border-gray-100 bg-gray-50 object-contain p-1"
          />
        ))}
        {extra > 0 && <span className="text-[11px] font-bold text-gray-500">+{extra} more</span>}
      </div>

      {order.status === 'pending_payment' && (
        <p className="mt-3 text-[11px] text-amber-700">
          Not paid yet. We are holding your items until {formatDateTime(order.expiresAt)}.
        </p>
      )}
      {order.status === 'cancelled' && cancelReasonText(order.cancelReason) && (
        <p className="mt-3 text-[11px] text-gray-500">{cancelReasonText(order.cancelReason)}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} ·{' '}
          <span className="font-black text-gray-900">
            {formatMoney(order.totalMinor, order.currency)}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {canCancel(order.status) && (
            <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
          )}
          <Link
            to={`/orders/${order.id}`}
            className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            View details
          </Link>
        </div>
      </div>
    </li>
  );
}

/** The signed-in customer's orders, newest first, ten at a time. */
export default function MyOrdersPage() {
  const navigate = useNavigate();
  const query = useInfiniteQuery({
    queryKey: ['orders', 'list'],
    queryFn: ({ pageParam }) => listOrders(pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 0,
  });

  const orders = query.data?.pages.flatMap((page) => page.orders) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">My Orders</h1>
        </div>

        {query.isPending && (
          <p role="status" className="py-16 text-center text-xs text-gray-500">
            Loading your orders…
          </p>
        )}

        {query.isError && !query.data && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-bold text-red-700">We couldn&apos;t load your orders.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {query.data && orders.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Package size={28} aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-gray-900">No orders yet</h2>
            <p className="mt-1 text-xs text-gray-500">
              When you place an order, it will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-6 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
            >
              Start shopping
            </button>
          </div>
        )}

        {orders.length > 0 && (
          <>
            <ul className="space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </ul>

            {query.isFetchNextPageError && (
              <p role="alert" className="mt-4 text-center text-xs font-semibold text-red-600">
                We couldn&apos;t load more orders. Please try again.
              </p>
            )}
            {query.hasNextPage && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                  className="cursor-pointer rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
