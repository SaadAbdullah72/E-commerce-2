import { Search, ShoppingBag } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { focusRing } from '@/shared/design/tokens';
import { formatDateTime, formatRelative } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input, Select } from '@/shared/ui/Input';
import PageHeader from '@/shared/ui/PageHeader';

import { NeedsRefundBadge, OrderStatusBadge } from '../components/OrderBadges';
import QueryState from '../components/QueryState';
import { useAdminOrders, useOrderStats } from '../hooks/useAdminOrders';
import { ORDER_STATUS_OPTIONS } from '../lib/orderFlow';

const chipClass = (active) =>
  `inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 max-md:min-h-11 ${focusRing} ${
    active
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

/**
 * A filter chip. When the number of matching orders is known it is shown inside the chip; the
 * chip's name stays just the label, and the number is read out as its description.
 */
function FilterChip({ label, active, onClick, count }) {
  const describedBy = useId();
  const known = typeof count === 'number';
  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        aria-describedby={known ? describedBy : undefined}
        onClick={onClick}
        className={chipClass(active)}
      >
        {label}
        {known && (
          <span
            aria-hidden="true"
            className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
              active ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {count}
          </span>
        )}
      </button>
      {known && (
        <span id={describedBy} className="sr-only">
          {count === 1 ? '1 order' : `${count} orders`}
        </span>
      )}
    </>
  );
}

const initialOf = (name) => (name?.trim()?.[0] ?? '?').toUpperCase();

function OrderRow({ order }) {
  return (
    <li>
      <Link
        to={`/admin/orders/${order.id}`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700"
          >
            {initialOf(order.customerName)}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
              {order.paymentIssue && <NeedsRefundBadge />}
            </span>
            <span className="block truncate text-xs text-gray-600">
              {order.customerName}
              {order.customerEmail ? ` · ${order.customerEmail}` : ''}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {formatMoney(order.totalMinor, order.currency)}
          </span>
          <OrderStatusBadge status={order.status} />
          <time
            dateTime={order.createdAt}
            title={formatDateTime(order.createdAt)}
            className="text-gray-600 sm:w-28 sm:text-right"
          >
            {formatRelative(order.createdAt)}
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
  // the same cached numbers the sidebar and Overview use: no extra request, and no number if unknown
  const toShipCount = useOrderStats((stats) => stats.toShip).data;
  const refundCount = useOrderStats((stats) => stats.needsRefund).data;
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
      <PageHeader
        title="Orders"
        description="Newest first. Open an order to ship it, deliver it or add a tracking number."
      />

      <Card className="flex flex-wrap items-center gap-3 !p-3 sm:!p-4">
        <FilterChip
          label="To ship"
          active={status === 'paid'}
          count={toShipCount}
          onClick={() => setStatus(status === 'paid' ? '' : 'paid')}
        />
        <FilterChip
          label="Needs refund"
          active={needsRefund}
          count={refundCount}
          onClick={() => setNeedsRefund((value) => !value)}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="!w-auto"
        >
          <option value="">All statuses</option>
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <form onSubmit={submitSearch} role="search" className="flex min-w-0 flex-1 basis-72 gap-2">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Order number or customer email"
              aria-label="Search orders"
              leadingIcon={<Search size={16} />}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className={`cursor-pointer rounded px-1 text-sm font-semibold text-blue-700 underline hover:text-blue-800 max-md:min-h-11 ${focusRing}`}
          >
            Clear filters
          </button>
        )}
      </Card>

      <Card flush>
        <QueryState
          query={query}
          isEmpty={orders.length === 0}
          emptyText={filtered ? 'No orders match these filters.' : 'No orders yet.'}
          emptyIcon={ShoppingBag}
          label="orders"
        >
          <ul className="divide-y divide-gray-100">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          <div className="border-t border-gray-100 p-3 text-center">
            {query.hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            ) : (
              <p className="text-xs text-gray-500">End of the list</p>
            )}
            {query.isFetchNextPageError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                We couldn&apos;t load more orders. Try again.
              </p>
            )}
          </div>
        </QueryState>
      </Card>
    </section>
  );
}
