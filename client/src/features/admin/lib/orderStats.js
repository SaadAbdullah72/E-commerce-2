const STATUS_KEYS = ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A missing or malformed number throws, so a page shows an error instead of a made-up 0. */
function count(value, name) {
  const number = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(`Bad value for ${name}`);
  }
  return number;
}

function list(value, name) {
  if (!Array.isArray(value)) throw new Error(`Bad list for ${name}`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`Bad text for ${name}`);
  return value;
}

/**
 * Check and reshape what `admin_order_stats()` returns.
 *
 * @param {any} raw
 * @param {Date} [now] only used to say which day "today" is (UTC); tests pass a fixed date
 */
export function parseOrderStats(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') throw new Error('Bad stats');
  if (!raw.by_status || typeof raw.by_status !== 'object') throw new Error('Bad by_status');

  const byStatus = {};
  for (const key of STATUS_KEYS) byStatus[key] = count(raw.by_status[key], `by_status.${key}`);

  return {
    today: now.toISOString().slice(0, 10),
    byStatus,
    toShip: count(raw.to_ship, 'to_ship'),
    needsRefund: count(raw.needs_refund, 'needs_refund'),
    revenue: list(raw.revenue, 'revenue').map((row) => ({
      currency: text(row?.currency, 'revenue.currency'),
      orders: count(row.orders, 'revenue.orders'),
      allTimeMinor: count(row.all_time_minor, 'revenue.all_time_minor'),
      last24hMinor: count(row.last_24h_minor, 'revenue.last_24h_minor'),
      last7dMinor: count(row.last_7d_minor, 'revenue.last_7d_minor'),
      last30dMinor: count(row.last_30d_minor, 'revenue.last_30d_minor'),
      averageOrderMinor: count(row.average_order_minor, 'revenue.average_order_minor'),
    })),
    daily: list(raw.daily, 'daily').map((row) => {
      const day = String(row?.day ?? '');
      if (!DAY.test(day)) throw new Error('Bad day');
      return {
        day,
        currency: text(row.currency, 'daily.currency'),
        orders: count(row.orders, 'daily.orders'),
        revenueMinor: count(row.revenue_minor, 'daily.revenue_minor'),
      };
    }),
    topProducts: list(raw.top_products, 'top_products').map((row) => ({
      productId: text(String(row?.product_id ?? ''), 'top_products.product_id'),
      title: String(row.title ?? ''),
      currency: text(row.currency, 'top_products.currency'),
      units: count(row.units, 'top_products.units'),
      revenueMinor: count(row.revenue_minor, 'top_products.revenue_minor'),
    })),
  };
}

/** Every status except cancelled and unpaid: the orders that count as sales. */
export const paidOrderCount = (byStatus) => byStatus.paid + byStatus.shipped + byStatus.delivered;

/** The currency with the most orders (the one the Overview shows), or null before any sale. */
export function primaryCurrency(revenue) {
  let best = null;
  for (const row of revenue) if (!best || row.orders > best.orders) best = row;
  return best ? best.currency : null;
}

/**
 * Revenue per day for one currency over the last `days` days (oldest first). The database only
 * returns days that had sales, so the gaps are filled with real zeros here.
 *
 * @param {{ day: string, currency: string, revenueMinor: number }[]} daily
 * @param {string} currency
 * @param {string} today "YYYY-MM-DD" (UTC)
 * @param {number} [days]
 * @returns {{ day: string, count: number }[]}
 */
export function fillDailyRevenue(daily, currency, today, days = 30) {
  const byDay = new Map();
  for (const row of daily) {
    if (row.currency === currency) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.revenueMinor);
  }
  const [year, month, date] = today.split('-').map(Number);
  const points = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const day = new Date(Date.UTC(year, month - 1, date - back)).toISOString().slice(0, 10);
    points.push({ day, count: byDay.get(day) ?? 0 });
  }
  return points;
}
