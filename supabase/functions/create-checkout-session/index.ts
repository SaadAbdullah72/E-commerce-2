// Starts a Stripe Checkout payment for a signed-in CUSTOMER.
//   1. place_order (database) validates the cart, takes prices from the database, reserves stock
//      and creates a pending_payment order. Nothing about money is trusted from the browser.
//   2. A Stripe Checkout Session is created from that saved order.
//   3. The session id is stored on the order and the browser is sent to Stripe.
// If anything fails after the order exists, the order is released so stock is not held for nothing.
// The Stripe secret key never leaves this function.
// Deployed by pasting into Supabase Dashboard -> Edge Functions
//   (name: create-checkout-session, JWT verification ON).
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

const ALLOWED_ORIGINS = new Set([
  'https://e-commerce-2-hazel.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);
const MAX_BODY_BYTES = 20_000;
const MAX_CALLS_PER_MINUTE = 10;
// TODO(market): Stripe's minimum charge is 50 cents for USD; other currencies differ.
const MIN_CHARGE_MINOR = 50;
// Stripe needs a session to last at least 30 minutes. The database holds stock for the same time.
const SESSION_SECONDS = 31 * 60;

// Best-effort limit (memory is per function instance, so this is a brake, not a guarantee).
const recent = new Map<string, number[]>();

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function fail(
  status: number,
  code: string,
  message: string,
  origin: string | null,
  extra: Record<string, unknown> = {},
) {
  return reply({ error: { code, message, ...extra } }, status, origin);
}

function tooMany(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((time) => now - time < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > MAX_CALLS_PER_MINUTE;
}

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

/** The database raises short codes (see migration 0009); turn them into HTTP answers. */
function mapOrderError(
  error: { message?: string; details?: string; code?: string },
  origin: string | null,
) {
  const code = (error.message ?? '').trim();
  const productId = error.details || undefined;

  if (error.code === '42501') return fail(401, 'not_signed_in', 'Please sign in to check out.', origin);

  switch (code) {
    case 'invalid_cart':
      return fail(400, code, 'Your cart is not valid. Please review it and try again.', origin);
    case 'invalid_shipping':
      return fail(400, code, 'Please check your shipping details.', origin);
    case 'product_unavailable':
      return fail(409, code, 'An item in your cart is no longer available.', origin, { productId });
    case 'insufficient_stock':
      return fail(409, code, 'There is not enough stock for an item in your cart.', origin, { productId });
    case 'mixed_currency':
      return fail(400, code, 'Your cart mixes currencies. Please check out the items separately.', origin);
    case 'too_many_pending':
      return fail(429, code, 'You already have unpaid orders open. Finish or cancel one first.', origin);
    case 'coupon_not_found':
      return fail(422, code, 'That coupon code is not valid.', origin);
    case 'coupon_not_started':
      return fail(422, code, 'That coupon is not active yet.', origin);
    case 'coupon_expired':
      return fail(422, code, 'That coupon has expired.', origin);
    case 'coupon_used_up':
      return fail(422, code, 'That coupon has been fully used.', origin);
    case 'coupon_already_used':
      return fail(422, code, 'You have already used that coupon.', origin);
    case 'coupon_min_subtotal':
      return fail(422, code, 'Your order is below the minimum for that coupon.', origin);
    default:
      return fail(500, 'order_failed', 'We could not place your order. Please try again.', origin);
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Method not allowed', origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return fail(403, 'forbidden', 'Forbidden', origin);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !supabaseUrl || !anonKey || !serviceKey) {
    return fail(500, 'not_configured', 'Checkout is not configured', origin);
  }

  // Who is calling? Checked with the caller's own token.
  const authorization = request.headers.get('Authorization') ?? '';
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return fail(401, 'not_signed_in', 'Please sign in to check out.', origin);
  if (tooMany(userData.user.id)) return fail(429, 'rate_limited', 'Too many requests. Please wait a moment.', origin);

  // ---- Read the request (the database validates the details; this only shapes them) ----
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Request too large', origin);
    body = JSON.parse(text);
  } catch {
    return fail(400, 'invalid_request', 'Invalid request', origin);
  }
  if (!body || typeof body !== 'object' || !Array.isArray(body.items) || body.items.length > 50) {
    return fail(400, 'invalid_cart', 'Your cart is not valid. Please review it and try again.', origin);
  }

  const items = [];
  for (const line of body.items as Record<string, unknown>[]) {
    if (!line || typeof line !== 'object') {
      return fail(400, 'invalid_cart', 'Your cart is not valid. Please review it and try again.', origin);
    }
    items.push({
      product_id: line.productId,
      size: line.size ?? null,
      color: line.color ?? null,
      quantity: line.quantity,
    });
  }
  const shipping = (body.shipping ?? {}) as Record<string, unknown>;
  const p_shipping = {
    full_name: asText(shipping.fullName),
    email: asText(shipping.email),
    phone: asText(shipping.phone),
    address: asText(shipping.address),
    state: asText(shipping.state),
    city: asText(shipping.city),
    courier: asText(shipping.courier),
    notes: asText(shipping.notes),
  };
  const couponCode = typeof body.couponCode === 'string' && body.couponCode.trim() ? body.couponCode : null;

  // ---- 1. The database places the order (prices, stock, coupon, delivery fee) ----
  const { data: placed, error: placeError } = await asCaller.rpc('place_order', {
    p_items: items,
    p_shipping,
    p_coupon_code: couponCode,
  });
  if (placeError || !placed?.order_id) {
    return placeError
      ? mapOrderError(placeError, origin)
      : fail(500, 'order_failed', 'We could not place your order. Please try again.', origin);
  }
  const orderId: string = placed.order_id;

  // From here on, a failure must give the stock back.
  const asService = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 });
  const release = async () => {
    await asService.rpc('release_order', { p_order_id: orderId, p_reason: 'error' });
  };

  try {
    // The saved order is the source of truth (read with the caller's token: row security applies).
    const { data: order } = await asCaller
      .from('orders')
      .select('order_number, currency, discount_minor, delivery_fee_minor, total_minor, ship_email, coupon_code')
      .eq('id', orderId)
      .single();
    const { data: lines } = await asCaller
      .from('order_items')
      .select('title, image_url, size, color, unit_price_minor, quantity')
      .eq('order_id', orderId);
    if (!order || !lines || lines.length === 0) throw new Error('order not readable');

    if (order.total_minor < MIN_CHARGE_MINOR) {
      await release();
      return fail(
        422,
        'amount_too_small',
        'This order is too small to pay online. Add another item and try again.',
        origin,
      );
    }

    const currency = String(order.currency).toLowerCase();

    // ---- 2. The Stripe Checkout Session ----
    const discounts: { coupon: string }[] = [];
    if (order.discount_minor > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: order.discount_minor,
          currency,
          duration: 'once',
          max_redemptions: 1,
          name: `Coupon ${order.coupon_code ?? ''}`.trim().slice(0, 40),
        },
        { idempotencyKey: `coupon-${orderId}` },
      );
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: orderId,
        customer_email: order.ship_email,
        line_items: lines.map((line) => {
          const variant = [line.size && `Size: ${line.size}`, line.color && `Colour: ${line.color}`]
            .filter(Boolean)
            .join(' · ');
          const image = String(line.image_url ?? '');
          return {
            quantity: line.quantity,
            price_data: {
              currency,
              unit_amount: line.unit_price_minor,
              product_data: {
                name: line.title,
                ...(variant ? { description: variant } : {}),
                ...(image.startsWith('https://res.cloudinary.com/') && image.length <= 2048
                  ? { images: [image] }
                  : {}),
              },
            },
          };
        }),
        ...(discounts.length > 0 ? { discounts } : {}),
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: order.delivery_fee_minor, currency },
              display_name: order.delivery_fee_minor > 0 ? 'Delivery' : 'Free delivery',
            },
          },
        ],
        metadata: { order_id: orderId, order_number: order.order_number },
        payment_intent_data: {
          metadata: { order_id: orderId, order_number: order.order_number },
          description: `ShopYaro order ${order.order_number}`,
        },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        success_url: `${origin}/order/success?order=${orderId}`,
        cancel_url: `${origin}/order/cancelled?order=${orderId}`,
      },
      { idempotencyKey: `checkout-${orderId}` },
    );
    if (!session.url) throw new Error('Stripe returned no checkout URL');

    // ---- 3. Remember the session on the order; align the stock hold with its expiry ----
    const { data: attached, error: attachError } = await asService.rpc('attach_stripe_session', {
      p_order_id: orderId,
      p_session_id: session.id,
      p_expires_at: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + SESSION_SECONDS) * 1000).toISOString(),
    });
    if (attachError || attached !== true) {
      // Do not leave a payable session that the order does not know about.
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error('could not attach session');
    }

    return reply({ url: session.url, orderId, orderNumber: order.order_number }, 200, origin);
  } catch (error) {
    console.error('create-checkout-session failed', orderId, error instanceof Error ? error.message : error);
    await release().catch(() => undefined);
    return fail(502, 'payment_unavailable', 'We could not start the payment. Please try again.', origin);
  }
});
