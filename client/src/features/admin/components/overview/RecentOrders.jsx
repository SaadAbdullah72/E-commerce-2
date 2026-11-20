import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatDateTime, formatRelative } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';
import { Card, CardHeader } from '@/shared/ui/Card';

import { useAdminOrders } from '../../hooks/useAdminOrders';
import { NeedsRefundBadge, OrderStatusBadge } from '../OrderBadges';
import QueryState from '../QueryState';

const SHOWN = 5;
const NO_FILTERS = {};

/** The latest few orders. Each row opens that order. */
export default function RecentOrders() {
  const query = useAdminOrders(NO_FILTERS);
  const orders = (query.data?.pages[0]?.orders ?? []).slice(0, SHOWN);

  return (
    <Card flush>
      <CardHeader className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">Recent orders</h3>
        <Link to="/admin/orders" className="rounded text-sm font-medium text-blue-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <QueryState
        query={query}
        label="recent orders"
        isEmpty={orders.length === 0}
        emptyIcon={ShoppingBag}
        emptyText="No orders yet. Orders appear here as soon as customers check out."
      >
        <ul className="divide-y divide-gray-100">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/admin/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-gray-50 sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900">{order.orderNumber}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {[order.customerName, order.customerEmail].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <OrderStatusBadge status={order.status} />
                  {order.paymentIssue && <NeedsRefundBadge />}
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {formatMoney(order.totalMinor, order.currency)}
                  </span>
                  <time
                    dateTime={order.createdAt}
                    title={formatDateTime(order.createdAt)}
                    className="text-xs text-gray-500"
                  >
                    {formatRelative(order.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </Card>
  );
}
