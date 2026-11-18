import { Info } from 'lucide-react';

import { formatMoney } from '@/shared/lib/formatMoney';

import ColumnChart from '../components/charts/ColumnChart';
import HBarChart from '../components/charts/HBarChart';
import StackedBar from '../components/charts/StackedBar';
import QueryState from '../components/QueryState';
import { useCatalogStats } from '../hooks/useAdminData';
import { useOrderStats } from '../hooks/useAdminOrders';
import { LOW_STOCK_THRESHOLD } from '../lib/adminStats';
import { fillDailyRevenue } from '../lib/orderStats';

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

const GROSS_NOTE =
  'Revenue is gross (it includes paid, shipped and delivered orders). Refunds are handled manually in Stripe and are not deducted. Days are counted in UTC.';

/** Orders, revenue and best sellers: real numbers from `admin_order_stats()`. */
function OrdersAnalytics() {
  const query = useOrderStats();
  const stats = query.data;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-black text-gray-900">Orders and revenue</h3>
      <QueryState query={query} isEmpty={false} emptyText="" label="order numbers">
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="To ship" value={stats.toShip.toLocaleString()} />
              <Kpi label="Needs refund" value={stats.needsRefund.toLocaleString()} />
              <Kpi label="Shipped" value={stats.byStatus.shipped.toLocaleString()} />
              <Kpi label="Delivered" value={stats.byStatus.delivered.toLocaleString()} />
            </div>

            <Panel title="Orders by status">
              <StackedBar
                emptyText="No orders yet."
                segments={[
                  {
                    label: 'Awaiting payment',
                    value: stats.byStatus.pending_payment,
                    tone: 'amber',
                  },
                  { label: 'Paid', value: stats.byStatus.paid, tone: 'blue' },
                  { label: 'Shipped', value: stats.byStatus.shipped, tone: 'indigo' },
                  { label: 'Delivered', value: stats.byStatus.delivered, tone: 'green' },
                  { label: 'Cancelled', value: stats.byStatus.cancelled, tone: 'gray' },
                ]}
              />
            </Panel>

            {stats.revenue.length === 0 ? (
              <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <h3 className="text-sm font-bold text-gray-700">Revenue</h3>
                <p className="mt-3 text-sm text-gray-500">
                  No paid orders yet. Revenue appears here after the first payment.
                </p>
              </section>
            ) : (
              stats.revenue.map((row) => {
                const money = (minor) => formatMoney(minor, row.currency);
                const products = stats.topProducts.filter((item) => item.currency === row.currency);
                return (
                  <div key={row.currency} className="space-y-4">
                    <h4 className="text-sm font-black text-gray-900">Revenue ({row.currency})</h4>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                      <Kpi label="Last 24 hours" value={money(row.last24hMinor)} />
                      <Kpi label="Last 7 days" value={money(row.last7dMinor)} />
                      <Kpi label="Last 30 days" value={money(row.last30dMinor)} />
                      <Kpi label="All time" value={money(row.allTimeMinor)} />
                      <Kpi label="Paid orders" value={row.orders.toLocaleString()} />
                      <Kpi label="Average order" value={money(row.averageOrderMinor)} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Panel title="Revenue, last 30 days" note="Per day (UTC)">
                        <ColumnChart
                          points={fillDailyRevenue(stats.daily, row.currency, stats.today)}
                          unit="in revenue"
                          formatValue={money}
                        />
                      </Panel>
                      <Panel title="Best sellers" note="By units sold">
                        <HBarChart
                          emptyText="No sales yet."
                          rows={products.map((item) => ({
                            id: `${item.productId}-${item.currency}`,
                            label: item.title,
                            value: item.units,
                            extra: `units · ${money(item.revenueMinor)}`,
                          }))}
                        />
                      </Panel>
                    </div>
                  </div>
                );
              })
            )}

            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span title={GROSS_NOTE}>{GROSS_NOTE}</span>
            </p>
          </div>
        )}
      </QueryState>
    </div>
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
          Live numbers from your catalog, customers and orders.
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

      <OrdersAnalytics />
    </section>
  );
}
