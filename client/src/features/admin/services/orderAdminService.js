import { supabase } from '@/lib/supabase/client';

import { isUuid } from '../../checkout/services/checkoutService';
import { orderStatusInfo, validateTracking } from '../lib/orderFlow';
import { parseOrderStats } from '../lib/orderStats';

export const ADMIN_ORDERS_PAGE_SIZE = 25;

/** created_at exactly as the database prints it, e.g. 2026-11-16T15:09:13.32076+00:00 */
const DB_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const STATUSES = ['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'];

// Named columns only: "select *" is refused for browsers (Stripe ids are hidden).
const LIST_COLUMNS =
  'id, order_number, status, currency, total_minor, ship_name, ship_email, payment_issue, tracking_number, created_at';

const LIST_FAILED = "We couldn't load the orders. Please try again.";
const STATS_FAILED = "We couldn't load the order numbers. Please try again.";

/**
 * The search text goes into a PostgREST filter, where , ( ) and wildcards have meaning. Keep
 * only what an order number or an email address needs.
 *
 * @param {string} text
 */
export function cleanOrderSearch(text) {
  return String(text ?? '')
    .replace(/[^A-Za-z0-9@.+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * One page of orders, newest first. Pages are chained by (created_at, id) so orders arriving
 * while someone reads never shift or repeat rows. Only admins can read every order (row-level
 * security).
 *
 * @param {{ status?: string, needsRefund?: boolean, search?: string,
 *   cursor?: { createdAt: string, id: string } | null }} [filters]
 */
export async function listAdminOrders({
  status = '',
  needsRefund = false,
  search = '',
  cursor = null,
} = {}) {
  let query = supabase
    .from('orders')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ADMIN_ORDERS_PAGE_SIZE + 1); // one extra tells us whether there is another page

  if (STATUSES.includes(status)) query = query.eq('status', status);
  if (needsRefund) query = query.not('payment_issue', 'is', null);

  const term = cleanOrderSearch(search);
  if (term) query = query.or(`order_number.ilike.%${term}%,ship_email.ilike.%${term}%`);

  if (cursor) {
    if (!DB_TIMESTAMP.test(cursor.createdAt) || !isUuid(cursor.id)) throw new Error(LIST_FAILED);
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(LIST_FAILED);

  const rows = data ?? [];
  const page = rows.slice(0, ADMIN_ORDERS_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    orders: page.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      currency: row.currency,
      totalMinor: row.total_minor,
      customerName: row.ship_name,
      customerEmail: row.ship_email,
      paymentIssue: row.payment_issue,
      trackingNumber: row.tracking_number,
      createdAt: row.created_at,
    })),
    nextCursor:
      rows.length > ADMIN_ORDERS_PAGE_SIZE && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}

/**
 * One order with everything an admin needs, including the Stripe ids (only this admin-only
 * function can read them). Null when the order does not exist.
 *
 * @param {string} orderId
 */
export async function getAdminOrder(orderId) {
  if (!isUuid(orderId)) return null;
  const { data, error } = await supabase.rpc('admin_get_order', { p_order_id: orderId });
  if (error) throw new Error("We couldn't load this order. Please try again.");
  if (!data) return null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    status: data.status,
    cancelReason: data.cancel_reason,
    paymentIssue: data.payment_issue,
    currency: data.currency,
    subtotalMinor: data.subtotal_minor,
    discountMinor: data.discount_minor,
    deliveryFeeMinor: data.delivery_fee_minor,
    totalMinor: data.total_minor,
    couponCode: data.coupon_code,
    accountEmail: data.account_email,
    shipping: {
      name: data.ship_name,
      email: data.ship_email,
      phone: data.ship_phone,
      address: data.ship_address,
      state: data.ship_state,
      city: data.ship_city,
      courier: data.ship_courier,
      notes: data.ship_notes,
    },
    trackingNumber: data.tracking_number,
    stripeSessionId: data.stripe_session_id,
    stripePaymentIntentId: data.stripe_payment_intent_id,
    createdAt: data.created_at,
    paidAt: data.paid_at,
    shippedAt: data.shipped_at,
    deliveredAt: data.delivered_at,
    cancelledAt: data.cancelled_at,
    expiresAt: data.expires_at,
    items: (data.items ?? []).map((item) => ({
      productId: item.product_id,
      title: item.title,
      imageUrl: item.image_url,
      size: item.size,
      color: item.color,
      unitPriceMinor: item.unit_price_minor,
      quantity: item.quantity,
      lineTotalMinor: item.line_total_minor,
    })),
  };
}

/**
 * Words for a refused order update. Raw database text is never shown.
 * @param {{ code?: string, message?: string, details?: string } | null | undefined} error
 */
export function friendlyOrderError(error) {
  switch (error?.message) {
    case 'invalid_transition': {
      const current = error.details ? orderStatusInfo(error.details).label : '';
      return `This order cannot be moved that way${
        current ? ` (it is currently "${current}")` : ''
      }. Reload the page to see its latest state.`;
    }
    case 'invalid_tracking':
      return 'That tracking number is not valid. Use at most 100 characters, without control characters.';
    case 'order_not_found':
      return 'This order no longer exists. Reload the page.';
    default:
  }
  if (error?.code === '42501') return 'You do not have permission to update orders.';
  if (error?.code === 'P0002') return 'This order no longer exists. Reload the page.';
  return 'We could not update the order. Please try again.';
}

/**
 * Ship or deliver an order, or change its tracking number. The database decides what is allowed
 * (forward only) and writes the Activity log entry.
 *
 * @param {string} orderId
 * @param {{ status?: 'shipped' | 'delivered' | null, tracking?: string | null }} change
 *   tracking: undefined/null = leave as it is, '' = remove it
 * @returns {Promise<{ id: string, status: string, trackingNumber: string | null,
 *   shippedAt: string | null, deliveredAt: string | null, changed: boolean }>}
 */
export async function updateAdminOrder(orderId, { status = null, tracking = null } = {}) {
  if (!isUuid(orderId)) throw new Error(friendlyOrderError({ message: 'order_not_found' }));
  if (tracking !== null && validateTracking(tracking)) {
    throw new Error(friendlyOrderError({ message: 'invalid_tracking' }));
  }

  const { data, error } = await supabase.rpc('admin_update_order', {
    p_order_id: orderId,
    p_status: status,
    p_tracking: tracking,
  });
  if (error) throw new Error(friendlyOrderError(error));

  return {
    id: data.id,
    status: data.status,
    trackingNumber: data.tracking_number,
    shippedAt: data.shipped_at,
    deliveredAt: data.delivered_at,
    changed: data.changed === true,
  };
}

/** Counts, revenue, daily revenue and top products, worked out by `admin_order_stats()`. */
export async function getOrderStats() {
  const { data, error } = await supabase.rpc('admin_order_stats');
  if (error) throw new Error(STATS_FAILED);
  try {
    return parseOrderStats(data);
  } catch {
    throw new Error(STATS_FAILED);
  }
}
