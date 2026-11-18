import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';

import { NeedsRefundBadge, OrderStatusBadge } from '../components/OrderBadges';
import QueryState from '../components/QueryState';
import { useAdminOrders } from '../hooks/useAdminOrders';
import { ORDER_STATUS_OPTIONS } from '../lib/orderFlow';

const selectClass = 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm';
const chipClass = (active) =>
  `cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition ${
    active
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
  }`;

function OrderRow({ order }) {
  return (
    <li>
      <Link
        to={`/admin/orders/${order.id}`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50"
      >
        <span className="min-w-0 flex-1 basis-48">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-gray-900">{order.orderNumber}</span>
            {order.paymentIssue && <NeedsRefundBadge />}
          </span>
          <span className="block truncate text-xs text-gray-500">
            {order.customerName}
            {order.customerEmail ? ` · ${order.customerEmail}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-4 text-xs">
          <span className="font-bold text-gray-900">
            {formatMoney(order.totalMinor, order.currency)}
          </span>
          <OrderStatusBadge status={order.status} />
          <time dateTime={order.createdAt} className="w-32 text-right text-gray-500">
            {formatDateTime(order.createdAt)}
          </time>
        </span>
      </Link>
    </li>
  );
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const [needsRefund, setNeedsRefund] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const query = useAdminOrders({ status, needsRefund, search });
  const orders = query.data?.pages.flatMap((page) => page.orders) ?? [];
  const filtered = Boolean(status || needsRefund || search);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(draft.trim());
  };
  const clearFilters = () => {
    setStatus('');
    setNeedsRefund(false);
    setDraft('');
    setSearch('');
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Orders</h2>
        <p className="text-xs text-gray-500">
          Newest first. Open an order to ship it, deliver it or add a tracking number.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={status === 'paid'}
          onClick={() => setStatus(status === 'paid' ? '' : 'paid')}
          className={chipClass(status === 'paid')}
        >
          To ship
        </button>
        <button
          type="button"
          aria-pressed={needsRefund}
          onClick={() => setNeedsRefund((value) => !value)}
          className={chipClass(needsRefund)}
        >
          Needs refund
        </button>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Order number or customer email"
            aria-label="Search orders"
            className="w-64 max-w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Search
          </button>
        </form>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer text-sm font-semibold text-blue-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
        <QueryState
          query={query}
          isEmpty={orders.length === 0}
          emptyText={filtered ? 'No orders match these filters.' : 'No orders yet.'}
          label="orders"
        >
          <ul className="divide-y divide-gray-100">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          <div className="border-t border-gray-100 p-3 text-center">
            {query.hasNextPage ? (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">End of the list</p>
            )}
            {query.isFetchNextPageError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                We couldn&apos;t load more orders. Try again.
              </p>
            )}
          </div>
        </QueryState>
      </div>
    </section>
  );
}
