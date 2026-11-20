import { Info, TrendingDown, TrendingUp } from 'lucide-react';

import { formatMoney } from '@/shared/lib/formatMoney';
import { Card } from '@/shared/ui/Card';
import PageHeader from '@/shared/ui/PageHeader';
import Tooltip from '@/shared/ui/Tooltip';

import { AnalyticsSkeleton } from '../components/charts/AnalyticsSkeleton';
import ColumnChart from '../components/charts/ColumnChart';
import HBarChart from '../components/charts/HBarChart';
import Sparkline from '../components/charts/Sparkline';
import StackedBar from '../components/charts/StackedBar';
import QueryState from '../components/QueryState';
import { useCatalogStats } from '../hooks/useAdminData';
import { useOrderStats } from '../hooks/useAdminOrders';
import { LOW_STOCK_THRESHOLD } from '../lib/adminStats';
import { compactMoney, sevenDayTrend } from '../lib/chartScale';
import { fillDailyRevenue } from '../lib/orderStats';

function Panel({ title, note, children }) {
  return (
    <Card as="section">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {note && <p className="mb-4 text-xs text-gray-500">{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </Card>
  );
}

const TREND_STYLE = {
  up: { Icon: TrendingUp, color: 'text-green-700' },
  down: { Icon: TrendingDown, color: 'text-red-700' },
  flat: { Icon: null, color: 'text-gray-600' },
};

/**
 * One number. `trend` ({ direction, text }) and `spark` (a Sparkline) are optional. The trend is
 * written in words ("Up 12% ..."), so colour and arrow are never the only signal.
 */
function Kpi({ label, value, note, trend, spark }) {
  const style = trend ? TREND_STYLE[trend.direction] : null;
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-2 text-xs font-semibold text-gray-600">{label}</h3>
      <p className="text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
      {trend && (
        <div className="mt-2">
          <p className={`flex items-center gap-1 text-xs font-medium ${style.color}`}>
            {style.Icon && <style.Icon size={14} aria-hidden="true" />}
            {trend.text}
          </p>
          {trend.note && <p className="text-xs text-gray-500">{trend.note}</p>}
        </div>
      )}
      {/* the sparkline sits at the bottom, so cards in a row line up whatever else they show */}
      {spark && <div className="mt-auto pt-3">{spark}</div>}
    </div>
  );
}

const GROSS_NOTE =
  'Revenue is gross (it includes paid, shipped and delivered orders). Refunds are handled manually in Stripe and are not deducted. Days are counted in UTC.';

const GROSS_TIP =
  'Gross revenue: paid, shipped and delivered orders added up. Refunds are not taken off. Days are counted in UTC.';

/** How many orders each UTC day had, for the chart tooltip. */
function ordersByDay(daily, currency) {
  const byDay = new Map();
  for (const row of daily) {
    if (row.currency === currency) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.orders);
  }
  return byDay;
}

/** Orders, revenue and best sellers: real numbers from `admin_order_stats()`. */
function OrdersAnalytics() {
  const query = useOrderStats();
  const stats = query.data;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Orders and revenue</h3>
      <QueryState
        query={query}
        isEmpty={false}
        emptyText=""
        label="order numbers"
        skeleton={<AnalyticsSkeleton label="order numbers" kpis={4} panels={2} />}
      >
        {stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi label="To ship" value={stats.toShip.toLocaleString()} />
              <Kpi label="Needs refund" value={stats.needsRefund.toLocaleString()} />
              <Kpi label="Shipped" value={stats.byStatus.shipped.toLocaleString()} />
              <Kpi label="Delivered" value={stats.byStatus.delivered.toLocaleString()} />
            </div>

            <Panel title="Orders by status">
              <StackedBar
                emptyText="No orders yet."
                totalLabel="orders"
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
              <Card as="section" className="border-dashed bg-gray-50">
                <h3 className="text-base font-semibold text-gray-900">Revenue</h3>
                <p className="mt-3 text-sm text-gray-600">
                  No paid orders yet. Revenue appears here after the first payment.
                </p>
              </Card>
            ) : (
              stats.revenue.map((row) => {
                const money = (minor) => formatMoney(minor, row.currency);
                const products = stats.topProducts.filter((item) => item.currency === row.currency);
                const orders = ordersByDay(stats.daily, row.currency);
                const series = fillDailyRevenue(stats.daily, row.currency, stats.today).map(
                  (point) => {
                    const count = orders.get(point.day) ?? 0;
                    return count > 0
                      ? { ...point, extra: `${count} ${count === 1 ? 'order' : 'orders'}` }
                      : point;
                  },
                );
                const week = series.slice(-7);
                return (
                  <div key={row.currency} className="space-y-4">
                    <div className="flex items-center gap-1">
                      <h4 className="text-base font-semibold text-gray-900">
                        Revenue ({row.currency})
                      </h4>
                      <Tooltip content={GROSS_TIP}>
                        <button
                          type="button"
                          aria-label="About gross revenue"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 max-md:h-11 max-md:w-11"
                        >
                          <Info size={16} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Kpi
                        label="Last 24 hours"
                        value={money(row.last24hMinor)}
                        spark={
                          <Sparkline
                            points={week}
                            formatValue={money}
                            label="Last 7 days"
                            caption="Last 7 days, one point per UTC day (not hourly)"
                          />
                        }
                      />
                      <Kpi
                        label="Last 7 days"
                        value={money(row.last7dMinor)}
                        trend={sevenDayTrend(series)}
                        spark={
                          <Sparkline
                            points={week}
                            formatValue={money}
                            label="Last 7 days"
                            caption="Last 7 days, one point per UTC day"
                          />
                        }
                      />
                      <Kpi
                        label="Last 30 days"
                        value={money(row.last30dMinor)}
                        spark={
                          <Sparkline
                            points={series}
                            formatValue={money}
                            label="Last 30 days"
                            caption="Last 30 days, one point per UTC day"
                          />
                        }
                      />
                      <Kpi label="All time" value={money(row.allTimeMinor)} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Kpi label="Paid orders" value={row.orders.toLocaleString()} />
                      <Kpi label="Average order" value={money(row.averageOrderMinor)} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Panel
                        title="Revenue, last 30 days"
                        note="Per UTC day, today included. Its total can differ a little from the Last 30 days card, which counts the last 720 hours."
                      >
                        <ColumnChart
                          points={series}
                          unit="in revenue"
                          formatValue={money}
                          formatTick={(minor) => compactMoney(minor, row.currency)}
                          lineBelow={5}
                          emptyText="No sales in the last 30 days."
                        />
                      </Panel>
                      <Panel title="Best sellers" note="Ranked by units sold">
                        <HBarChart
                          emptyText="No sales yet. Once orders start coming in, top products will appear here."
                          rows={products.map((item) => ({
                            id: `${item.productId}-${item.currency}`,
                            label: item.title,
                            value: item.units,
                            extra: `units · ${money(item.revenueMinor)}`,
                            href: `/admin/products/${item.productId}`,
                          }))}
                        />
                      </Panel>
                    </div>
                  </div>
                );
              })
            )}

            <p className="flex items-start gap-1.5 text-xs text-gray-600">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{GROSS_NOTE}</span>
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
    <section className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Live numbers from your catalog, customers and orders."
      />

      <QueryState
        query={query}
        isEmpty={false}
        emptyText=""
        label="analytics"
        skeleton={<AnalyticsSkeleton label="analytics" kpis={4} panels={2} />}
      >
        {stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                    totalLabel="products"
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
                    totalLabel="active products"
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
              <ColumnChart
                points={stats.signups}
                unit="sign-ups"
                integer
                emptyText="No sign-ups in the last 30 days."
              />
            </Panel>
          </div>
        )}
      </QueryState>

      <OrdersAnalytics />
    </section>
  );
}
