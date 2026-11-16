import { supabase } from '@/lib/supabase/client';

import { cancelOrder, getOrder, isUuid } from '../../checkout/services/checkoutService';

export const ORDERS_PAGE_SIZE = 10;

/** created_at exactly as the database prints it, e.g. 2026-11-16T15:09:13.32076+00:00 */
const DB_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Where the next page starts: the last order already shown. created_at stays the exact text the
 * database sent (never a JavaScript Date, which would round the microseconds and could skip or
 * repeat orders); id breaks ties between orders made at the same moment.
 *
 * @typedef {{ createdAt: string, id: string }} OrdersCursor
 */

function mapListRow(row) {
  const items = row.order_items ?? [];
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    currency: row.currency,
    totalMinor: row.total_minor,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    cancelReason: row.cancel_reason,
    items: items.map((item) => ({
      title: item.title,
      imageUrl: item.image_url,
      quantity: item.quantity,
    })),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/**
 * One page of the signed-in customer's orders, newest first. Row-level security means only their
 * own orders can ever come back.
 *
 * @param {OrdersCursor | null} [cursor] the last order of the previous page, or null for the first page
 * @returns {Promise<{ orders: ReturnType<typeof mapListRow>[], nextCursor: OrdersCursor | null }>}
 */
export async function listOrders(cursor = null) {
  let query = supabase
    .from('orders')
    .select(
      'id, order_number, status, currency, total_minor, created_at, expires_at, cancel_reason, order_items(title, image_url, quantity)',
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ORDERS_PAGE_SIZE + 1); // one extra tells us whether there is another page

  if (cursor) {
    if (!DB_TIMESTAMP.test(cursor.createdAt) || !isUuid(cursor.id)) {
      throw new Error("We couldn't load your orders. Please try again.");
    }
    // Older than the cursor, or made at the same moment with a smaller id.
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error("We couldn't load your orders. Please try again.");

  const rows = data ?? [];
  const page = rows.slice(0, ORDERS_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    orders: page.map(mapListRow),
    nextCursor:
      rows.length > ORDERS_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/**
 * One order with everything the detail page shows, or null when it does not exist or is not the
 * customer's. A cancelled order also carries why it was cancelled (cancelReason).
 *
 * @param {string} orderId
 */
export async function getOrderDetail(orderId) {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.status !== 'cancelled') return { ...order, cancelReason: null };

  // The reason is a nicety: if it cannot be read the order still shows as cancelled.
  const { data } = await supabase
    .from('orders')
    .select('cancel_reason')
    .eq('id', orderId)
    .maybeSingle();
  return { ...order, cancelReason: data?.cancel_reason ?? null };
}

/**
 * Cancel one of the customer's UNPAID orders; its stock and coupon go back.
 * @param {string} orderId
 * @returns {Promise<boolean>} false when it could not be cancelled (already paid or cancelled)
 */
export const cancelMyOrder = (orderId) => cancelOrder(orderId);
