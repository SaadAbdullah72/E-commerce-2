// Receives Stripe's payment events and updates the order in the database.
// Stripe (not a signed-in user) calls this, so JWT verification is OFF for this function; the
// Stripe SIGNATURE is the only gate: a request without a valid signature is rejected.
//   paid                         -> mark_order_paid   (repeat-safe; checks amount + currency)
//   session expired / failed     -> release_order     (stock and coupon go back)
// If money arrives that cannot be fulfilled, mark_order_paid answers "needs_refund" and sets
// orders.payment_issue. For now this only LOGS it; refunds are done by hand in the Stripe Dashboard.
// TODO(refunds): refund automatically before going live.
// Deployed by pasting into Supabase Dashboard -> Edge Functions
//   (name: stripe-webhook, JWT verification OFF).
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 500_000;

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const stripe = stripeKey
  ? new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() })
  : null;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const text = (body: string, status: number) => new Response(body, { status });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return text('Method not allowed', 405);
  if (!stripe || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error('stripe-webhook is not configured');
    return text('Not configured', 500);
  }

  // The signature covers the EXACT raw body, so read it as text and do not re-serialise it.
  const signature = request.headers.get('stripe-signature');
  const raw = await request.text();
  if (!signature || raw.length > MAX_BODY_BYTES) return text('Bad request', 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      signature,
      webhookSecret,
      300, // reject events older than 5 minutes (replay protection)
      cryptoProvider,
    );
  } catch {
    return text('Invalid signature', 400);
  }

  const asService = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      // A completed session can still be "unpaid" for slow payment methods; wait for the success event.
      if (session.payment_status !== 'paid') return text('ok (not paid yet)', 200);

      const orderId = session.client_reference_id ?? session.metadata?.order_id ?? '';
      if (!UUID.test(orderId)) {
        console.error('payment event without a valid order id', event.id);
        return text('ok (no order)', 200);
      }
      const paymentIntent =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

      const { data, error } = await asService.rpc('mark_order_paid', {
        p_order_id: orderId,
        p_session_id: session.id,
        p_payment_intent: paymentIntent,
        p_amount_total: session.amount_total ?? -1,
        p_currency: session.currency ?? '',
      });
      if (error) {
        // An order we do not know: nothing to retry. Anything else: let Stripe retry.
        if (error.code === 'P0002') {
          console.error('payment for an unknown order', orderId, event.id);
          return text('ok (unknown order)', 200);
        }
        console.error('mark_order_paid failed', orderId, error.message);
        return text('Database error', 500);
      }
      if (data === 'needs_refund') {
        console.error('NEEDS REFUND: money received that cannot be fulfilled', {
          orderId,
          paymentIntent,
          sessionId: session.id,
        });
      }
      return text(`ok (${data})`, 200);
    }

    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.client_reference_id ?? session.metadata?.order_id ?? '';
      if (!UUID.test(orderId)) return text('ok (no order)', 200);

      const reason = event.type === 'checkout.session.expired' ? 'expired' : 'payment_failed';
      const { error } = await asService.rpc('release_order', { p_order_id: orderId, p_reason: reason });
      if (error) {
        console.error('release_order failed', orderId, error.message);
        return text('Database error', 500);
      }
      return text('ok (released)', 200);
    }

    default:
      // Any other event type is not needed; acknowledge so Stripe does not retry it.
      return text('ok (ignored)', 200);
  }
});
