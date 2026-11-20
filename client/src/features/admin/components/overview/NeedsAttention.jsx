import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardHeader } from '@/shared/ui/Card';

import { useLowStockProducts } from '../../hooks/useAdminData';
import { useOrderStats } from '../../hooks/useAdminOrders';
import { usePendingReviewCount } from '../../hooks/useAdminReviews';
import { stockStatus } from '../../lib/adminStats';
import QueryState from '../QueryState';
import StatusBadge from '../StatusBadge';

const plural = (count, one, many) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * Things that want the admin's attention: orders to ship and refunds (red, urgent), reviews
 * waiting (amber), then products that are out of stock or running low (amber). A count that
 * cannot load is left out, never shown as 0.
 */
export default function NeedsAttention() {
  const attention = useLowStockProducts();
  const toShip = useOrderStats((stats) => stats.toShip).data ?? 0;
  const needsRefund = useOrderStats((stats) => stats.needsRefund).data ?? 0;
  const pendingReviews = usePendingReviewCount().data ?? 0;

  const tasks = [
    toShip > 0 && {
      key: 'ship',
      to: '/admin/orders',
      text: `${plural(toShip, 'order', 'orders')} to ship`,
      tone: 'red',
      tag: 'Urgent',
    },
    needsRefund > 0 && {
      key: 'refund',
      to: '/admin/orders',
      text: `${plural(needsRefund, 'order needs', 'orders need')} a refund`,
      tone: 'red',
      tag: 'Urgent',
    },
    pendingReviews > 0 && {
      key: 'reviews',
      to: '/admin/reviews',
      text: `${plural(pendingReviews, 'review', 'reviews')} waiting for approval`,
      tone: 'amber',
      tag: 'Pending',
    },
  ].filter(Boolean);

  return (
    <Card flush>
      <CardHeader>
        <h3 className="text-base font-semibold text-gray-900">Needs attention</h3>
      </CardHeader>
      {tasks.length > 0 && (
        <ul className="divide-y divide-gray-100 border-b border-gray-100">
          {tasks.map((task) => (
            <li key={task.key}>
              <Link
                to={task.to}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-gray-900 transition-colors duration-150 hover:bg-gray-50"
              >
                <span>{task.text}</span>
                <StatusBadge tone={task.tone}>{task.tag}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <QueryState
        query={attention}
        label="stock list"
        isEmpty={attention.data?.length === 0}
        emptyIcon={CircleCheck}
        emptyText="Nothing is out of stock or running low."
      >
        <ul className="divide-y divide-gray-100">
          {attention.data?.map((product) => {
            const out = stockStatus(product.stock) === 'out';
            return (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="truncate text-gray-800">{product.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-gray-500">{product.stock} left</span>
                  <StatusBadge tone={out ? 'red' : 'amber'}>
                    {out ? 'Out of stock' : 'Low stock'}
                  </StatusBadge>
                </span>
              </li>
            );
          })}
        </ul>
      </QueryState>
    </Card>
  );
}
