import { formatMoney } from '@/shared/lib/formatMoney';

import ColumnChart from '../components/charts/ColumnChart';
import HBarChart from '../components/charts/HBarChart';
import StackedBar from '../components/charts/StackedBar';
import QueryState from '../components/QueryState';
import { useCatalogStats } from '../hooks/useAdminData';
import { LOW_STOCK_THRESHOLD } from '../lib/adminStats';

function Panel({ title, note, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {note && <p className="mb-3 text-[11px] text-gray-500">{note}</p>}
      <div className={note ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

function Kpi({ label, value, note }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
      <h3 className="mb-2 text-xs font-semibold text-gray-500">{label}</h3>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {note && <p className="mt-1 text-[11px] text-gray-400">{note}</p>}
    </div>
  );
}

/** Orders and revenue do not exist yet. Say so plainly instead of showing a made-up 0. */
function NoDataYet({ title }) {
  return (
    <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-700">{title}</h3>
      <p className="mt-3 text-sm text-gray-500">
        No data yet. Orders will appear here after checkout is built.
      </p>
    </section>
  );
}

export default function AnalyticsPage() {
  const query = useCatalogStats();
  const stats = query.data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Analytics</h2>
        <p className="text-xs text-gray-500">
          Live numbers from your catalog and customers. Sales figures arrive with checkout.
        </p>
      </div>

      <QueryState query={query} isEmpty={false} emptyText="" label="analytics">
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Customers" value={stats.customers.toLocaleString()} />
              <Kpi
                label="Active products"
                value={stats.products.active.toLocaleString()}
                note={`${stats.products.total.toLocaleString()} in total`}
              />
              <Kpi label="Inactive products" value={stats.products.inactive.toLocaleString()} />
              <Kpi
                label="Inventory value"
                value={formatMoney(stats.inventoryValueMinor)}
                note="Price × stock, active products"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Products per category" note="Active products, by category">
                <HBarChart
                  emptyText="No categories yet."
                  rows={stats.byCategory.map((category) => ({
                    id: category.id,
                    label: category.name,
                    value: category.active,
                    extra: category.inactive ? `(+${category.inactive} inactive)` : '',
                  }))}
                />
              </Panel>

              <div className="space-y-4">
                <Panel title="Active vs inactive">
                  <StackedBar
                    emptyText="No products yet."
                    segments={[
                      { label: 'Active', value: stats.products.active, tone: 'blue' },
                      { label: 'Inactive', value: stats.products.inactive, tone: 'gray' },
                    ]}
                  />
                </Panel>
                <Panel
                  title="Stock health"
                  note={`Active products. Low means ${LOW_STOCK_THRESHOLD} units or fewer.`}
                >
                  <StackedBar
                    emptyText="No active products yet."
                    segments={[
                      { label: 'In stock', value: stats.stock.healthy, tone: 'green' },
                      { label: 'Low', value: stats.stock.low, tone: 'amber' },
                      { label: 'Out of stock', value: stats.stock.outOfStock, tone: 'red' },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <Panel title="Sign-ups, last 30 days" note="New customer accounts per day (UTC)">
              <ColumnChart points={stats.signups} unit="sign-ups" />
            </Panel>
          </div>
        )}
      </QueryState>

      <div className="grid gap-4 sm:grid-cols-2">
        <NoDataYet title="Orders" />
        <NoDataYet title="Revenue" />
      </div>
    </section>
  );
}
