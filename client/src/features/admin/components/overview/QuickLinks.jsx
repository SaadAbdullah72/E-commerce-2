import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card } from '@/shared/ui/Card';

import { useAdminCount } from '../../hooks/useAdminData';
import { useOrderStats } from '../../hooks/useAdminOrders';
import { usePendingReviewCount } from '../../hooks/useAdminReviews';
import { NAV_ICONS } from '../adminNav';

/**
 * Six big shortcuts. A count is shown only where the page already has the number (it is never
 * a made-up 0 when it cannot load); the others are plain links.
 */
export default function QuickLinks() {
  const activeProducts = useAdminCount('activeProducts').data;
  const totalOrders = useOrderStats((stats) =>
    Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0),
  ).data;
  const pendingReviews = usePendingReviewCount().data;

  const tiles = [
    {
      path: 'products',
      label: 'Products',
      detail: typeof activeProducts === 'number' ? `${activeProducts.toLocaleString()} active` : '',
    },
    {
      path: 'orders',
      label: 'Orders',
      detail: typeof totalOrders === 'number' ? `${totalOrders.toLocaleString()} in total` : '',
    },
    {
      path: 'reviews',
      label: 'Reviews',
      detail: typeof pendingReviews === 'number' ? `${pendingReviews.toLocaleString()} pending` : '',
    },
    { path: 'coupons', label: 'Coupons', detail: '' },
    { path: 'banners', label: 'Banners', detail: '' },
    { path: 'analytics', label: 'Analytics', detail: '' },
  ];

  return (
    <section aria-labelledby="quick-links-title">
      <h3 id="quick-links-title" className="mb-3 text-base font-semibold text-gray-900">
        Quick links
      </h3>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => {
          const Icon = NAV_ICONS[tile.path];
          return (
            <li key={tile.path}>
              <Card
                as={Link}
                to={`/admin/${tile.path}`}
                interactive
                className="flex h-full flex-col gap-3 !p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{tile.label}</span>
                  {tile.detail && (
                    <span className="block text-xs tabular-nums text-gray-500">{tile.detail}</span>
                  )}
                </span>
                <ArrowRight size={16} className="mt-auto text-gray-400" aria-hidden="true" />
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
