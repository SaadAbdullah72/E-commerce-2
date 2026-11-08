import { useAuth } from '@/features/auth/hooks/useAuth';

import QueryState from '../components/QueryState';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useAdminCount, useLowStockProducts } from '../hooks/useAdminData';
import { LOW_STOCK_THRESHOLD, stockStatus } from '../lib/adminStats';

export default function OverviewPage() {
  const { user } = useAuth();
  const activeProducts = useAdminCount('activeProducts');
  const inactiveProducts = useAdminCount('inactiveProducts');
  const categories = useAdminCount('categories');
  const customers = useAdminCount('customers');
  const outOfStock = useAdminCount('outOfStock');
  const lowStock = useAdminCount('lowStock');
  const attention = useLowStockProducts();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-gray-900">Overview</h2>
        {user?.email && <p className="text-xs text-gray-500">Signed in as {user.email}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
        <StatCard label="Orders" note="Available after Phase 3" />
        <StatCard label="Revenue" note="Available after Phase 3" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
          Needs attention
        </h3>
        <QueryState
          query={attention}
          label="stock list"
          isEmpty={attention.data?.length === 0}
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
      </div>
    </section>
  );
}
