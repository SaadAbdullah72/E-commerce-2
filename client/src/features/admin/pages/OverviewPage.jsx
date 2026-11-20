import { Banknote, CreditCard, Plus, RotateCcw, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { MARKET } from '@/shared/constants/market';
import { formatMoney } from '@/shared/lib/formatMoney';
import { buttonClass } from '@/shared/ui/buttonStyles';
import PageHeader from '@/shared/ui/PageHeader';

import NeedsAttention from '../components/overview/NeedsAttention';
import QuickLinks from '../components/overview/QuickLinks';
import RecentOrders from '../components/overview/RecentOrders';
import StatCard from '../components/StatCard';
import { useAdminCount } from '../hooks/useAdminData';
import { useOrderStats } from '../hooks/useAdminOrders';
import { LOW_STOCK_THRESHOLD } from '../lib/adminStats';
import { paidOrderCount, primaryCurrency } from '../lib/orderStats';

/** Revenue of the last 30 days in the currency with the most orders (gross: refunds are not deducted). */
function revenueText(stats) {
  const currency = primaryCurrency(stats.revenue);
  const row = stats.revenue.find((item) => item.currency === currency);
  return currency ? formatMoney(row.last30dMinor, currency) : formatMoney(0);
}

const todayLabel = () =>
  new Intl.DateTimeFormat(MARKET.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  );

/** Red when something is waiting (urgent), plain when there is nothing to do. */
const urgentTone = (query) => (query.data > 0 ? 'danger' : 'default');

export default function OverviewPage() {
  const { user, account } = useAuth();
  const activeProducts = useAdminCount('activeProducts');
  const inactiveProducts = useAdminCount('inactiveProducts');
  const categories = useAdminCount('categories');
  const customers = useAdminCount('customers');
  const outOfStock = useAdminCount('outOfStock');
  const lowStock = useAdminCount('lowStock');
  const toShip = useOrderStats((stats) => stats.toShip);
  const needsRefund = useOrderStats((stats) => stats.needsRefund);
  const paidOrders = useOrderStats((stats) => paidOrderCount(stats.byStatus));
  const revenue = useOrderStats(revenueText);
  const [today] = useState(todayLabel);

  const name = account?.fullName || user?.email?.split('@')[0] || 'there';

  return (
    <section className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${name} · ${today}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/orders" className={buttonClass({ variant: 'secondary' })}>
              View orders
            </Link>
            <Link to="/admin/products/new" className={buttonClass({ variant: 'primary' })}>
              <Plus size={16} aria-hidden="true" /> Add product
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders to ship" query={toShip} tone={urgentTone(toShip)} icon={Truck} />
        <StatCard
          label="Needs refund"
          query={needsRefund}
          tone={urgentTone(needsRefund)}
          icon={RotateCcw}
        />
        <StatCard label="Paid orders" query={paidOrders} tone="info" icon={CreditCard} />
        <StatCard label="Revenue (last 30 days)" query={revenue} tone="success" icon={Banknote} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <NeedsAttention />
      </div>

      <section aria-labelledby="glance-title">
        <h3 id="glance-title" className="mb-3 text-base font-semibold text-gray-900">
          Shop at a glance
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Active products" query={activeProducts} />
          <StatCard label="Inactive products" query={inactiveProducts} />
          <StatCard label="Categories" query={categories} />
          <StatCard label="Customers" query={customers} />
          <StatCard label="Out of stock" query={outOfStock} tone="danger" />
          <StatCard
            label={`Low stock (${LOW_STOCK_THRESHOLD} or fewer)`}
            query={lowStock}
            tone="warning"
          />
        </div>
      </section>

      <QuickLinks />
    </section>
  );
}
