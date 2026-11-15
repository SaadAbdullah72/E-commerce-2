import { supabase } from '@/lib/supabase/client';

import { CheckoutError } from '../lib/checkoutErrors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Stripe's hosted payment page. Nothing else is accepted as a place to send the customer. */
const STRIPE_CHECKOUT_URL = /^https:\/\/checkout\.stripe\.com\//;
const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

export const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
export const isPaidStatus = (status) => PAID_STATUSES.includes(status);

/** The Edge Function answers errors as { error: { code, message, productId? } }. */
async function readFunctionError(error) {
  try {
    const body = await error.context.json();
    return body?.error ?? null;
  } catch {
    return null;
  }
}

/**
 * Place the order and get the Stripe payment page address. Prices, stock, coupon and delivery fee
 * are all decided on the server; only what the customer chose is sent.
 *
 * @param {object} args
 * @param {{ productId: string, size: string | null, color: string | null, quantity: number }[]} args.lines
 * @param {Record<string, string>} args.shipping
 * @param {string | null} [args.couponCode]
 * @returns {Promise<{ url: string, orderId: string, orderNumber: string }>}
 * @throws {CheckoutError}
 */
export async function startCheckout({ lines, shipping, couponCode = null }) {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      items: lines.map((line) => ({
        productId: line.productId,
        size: line.size ?? null,
        color: line.color ?? null,
        quantity: line.quantity,
      })),
      shipping: {
        fullName: shipping.fullName,
        email: shipping.email,
        phone: shipping.phone,
        address: shipping.address,
        state: shipping.state,
        city: shipping.city,
        courier: shipping.courier,
        notes: shipping.notes,
      },
      couponCode,
    },
  });

  if (error) {
    const detail = await readFunctionError(error);
    throw new CheckoutError(detail?.code ?? 'unknown', detail?.message, detail?.productId ?? null);
  }
  if (typeof data?.url !== 'string' || !STRIPE_CHECKOUT_URL.test(data.url)) {
    throw new CheckoutError('payment_unavailable');
  }
  return { url: data.url, orderId: data.orderId, orderNumber: data.orderNumber };
}

/** Send the browser to Stripe. A separate function so tests can replace it. */
export function redirectToCheckout(url) {
  window.location.assign(url);
}

/**
 * Preview a coupon at checkout. The server checks it again when the order is placed.
 *
 * @param {string} code
 * @param {number} subtotalMinor
 * @returns {Promise<{ ok: true, code: string, discountMinor: number }
 *   | { ok: false, reason: string, minSubtotalMinor?: number }>}
 */
export async function validateCoupon(code, subtotalMinor) {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code,
    p_subtotal_minor: subtotalMinor,
  });
  if (error || typeof data?.ok !== 'boolean') {
    throw new Error("We couldn't check that coupon. Please try again.");
  }
  if (!data.ok) {
    return { ok: false, reason: data.error, minSubtotalMinor: data.min_subtotal_minor };
  }
  return { ok: true, code: data.code, discountMinor: data.discount_minor };
}

/**
 * Give the stock and coupon of an UNPAID order back. True when it was released; false when there
 * was nothing to release (already cancelled, or paid).
 *
 * @param {string} orderId
 */
export async function cancelOrder(orderId) {
  if (!isUuid(orderId)) return false;
  const { data, error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId });
  if (error?.code === 'P0002') return false; // not this customer's order, or it does not exist
  if (error) throw new Error("We couldn't cancel the order.");
  return data === true;
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    currency: row.currency,
    subtotalMinor: row.subtotal_minor,
    discountMinor: row.discount_minor,
    deliveryFeeMinor: row.delivery_fee_minor,
    totalMinor: row.total_minor,
    couponCode: row.coupon_code,
    trackingNumber: row.tracking_number,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    shipping: {
      name: row.ship_name,
      email: row.ship_email,
      phone: row.ship_phone,
      address: row.ship_address,
      state: row.ship_state,
      city: row.ship_city,
      courier: row.ship_courier,
    },
    items: (row.items ?? []).map((item) => ({
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
 * One of the signed-in customer's orders, or null when it does not exist or is not theirs.
 * @param {string} orderId
 */
export async function getOrder(orderId) {
  if (!isUuid(orderId)) return null;
  const { data, error } = await supabase.rpc('get_my_order', { p_order_id: orderId });
  if (error) throw new Error("We couldn't load this order. Please try again.");
  return data ? mapOrder(data) : null;
}
