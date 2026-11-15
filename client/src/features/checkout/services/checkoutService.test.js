import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ functions: { invoke: vi.fn() }, rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { CheckoutError } from '../lib/checkoutErrors';
import {
  cancelOrder,
  getOrder,
  isPaidStatus,
  startCheckout,
  validateCoupon,
} from './checkoutService';

const ID = '11111111-1111-4111-8111-111111111111';
const lines = [
  { productId: ID, size: 'M', color: 'Red', quantity: 2, title: 'ignored', unitPriceMinor: 99999 },
];
const shipping = {
  fullName: 'Sam Lee',
  email: 'sam@example.com',
  phone: '+10000000000',
  address: '1 Test Street',
  state: 'Lagos State',
  city: 'City Central / Metropolis',
  courier: 'Shipbubble',
  notes: '',
  deliveryFeeMinor: 1,
};

beforeEach(() => vi.resetAllMocks());

describe('startCheckout', () => {
  it('sends only what the customer chose: no prices, no totals', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        url: 'https://checkout.stripe.com/c/pay/cs_test_1',
        orderId: ID,
        orderNumber: 'SY-001',
      },
      error: null,
    });

    const result = await startCheckout({ lines, shipping, couponCode: 'SAVE10' });

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      orderId: ID,
      orderNumber: 'SY-001',
    });
    const [name, { body }] = supabase.functions.invoke.mock.calls[0];
    expect(name).toBe('create-checkout-session');
    expect(body.items).toEqual([{ productId: ID, size: 'M', color: 'Red', quantity: 2 }]);
    expect(body.couponCode).toBe('SAVE10');
    expect(body.shipping.fullName).toBe('Sam Lee');
    const sent = JSON.stringify(body);
    expect(sent).not.toMatch(/99999|unitPrice|deliveryFee|total/i);
  });

  it('sends null for a missing size, colour and coupon', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/x', orderId: ID, orderNumber: 'SY-2' },
      error: null,
    });
    await startCheckout({ lines: [{ productId: ID, quantity: 1 }], shipping });
    const { body } = supabase.functions.invoke.mock.calls[0][1];
    expect(body.items[0]).toEqual({ productId: ID, size: null, color: null, quantity: 1 });
    expect(body.couponCode).toBeNull();
  });

  it('turns the server error body into a CheckoutError with its code and product', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: async () => ({
            error: { code: 'insufficient_stock', message: 'x', productId: ID },
          }),
        },
      },
    });

    const error = await startCheckout({ lines, shipping }).catch((caught) => caught);
    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.code).toBe('insufficient_stock');
    expect(error.productId).toBe(ID);
  });

  it('copes with an error it cannot read', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: new Error('network') });
    const error = await startCheckout({ lines, shipping }).catch((caught) => caught);
    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.code).toBe('unknown');
  });

  it('refuses to send the customer anywhere but Stripe', async () => {
    for (const url of ['https://evil.example/pay', 'http://checkout.stripe.com/x', undefined, 42]) {
      supabase.functions.invoke.mockResolvedValue({ data: { url, orderId: ID }, error: null });
      const error = await startCheckout({ lines, shipping }).catch((caught) => caught);
      expect(error).toBeInstanceOf(CheckoutError);
      expect(error.code).toBe('payment_unavailable');
    }
  });
});

describe('validateCoupon', () => {
  it('returns the discount for a good coupon', async () => {
    supabase.rpc.mockResolvedValue({
      data: { ok: true, code: 'SAVE10', discount_minor: 250 },
      error: null,
    });
    expect(await validateCoupon('save10', 2500)).toEqual({
      ok: true,
      code: 'SAVE10',
      discountMinor: 250,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('validate_coupon', {
      p_code: 'save10',
      p_subtotal_minor: 2500,
    });
  });

  it('returns the reason for a refused coupon', async () => {
    supabase.rpc.mockResolvedValue({
      data: { ok: false, error: 'min_subtotal', min_subtotal_minor: 5000 },
      error: null,
    });
    expect(await validateCoupon('BIG', 100)).toEqual({
      ok: false,
      reason: 'min_subtotal',
      minSubtotalMinor: 5000,
    });
  });

  it('throws a friendly error when the check itself fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'secret' } });
    const error = await validateCoupon('A', 1).catch((caught) => caught);
    expect(error.message).toBe("We couldn't check that coupon. Please try again.");
  });
});

describe('cancelOrder', () => {
  it('releases an unpaid order', async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    expect(await cancelOrder(ID)).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_my_order', { p_order_id: ID });
  });

  it('reports false when there was nothing to release, or it is not theirs', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await cancelOrder(ID)).toBe(false);
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002' } });
    expect(await cancelOrder(ID)).toBe(false);
  });

  it('does not even call the database for a bad id', async () => {
    expect(await cancelOrder('not-a-uuid')).toBe(false);
    expect(await cancelOrder(null)).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws on a real failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
    await expect(cancelOrder(ID)).rejects.toThrow("We couldn't cancel the order.");
  });
});

describe('getOrder', () => {
  const row = {
    id: ID,
    order_number: 'SY-001',
    status: 'paid',
    currency: 'USD',
    subtotal_minor: 2000,
    discount_minor: 200,
    delivery_fee_minor: 480,
    total_minor: 2280,
    coupon_code: 'SAVE10',
    tracking_number: null,
    created_at: '2030-01-01T00:00:00Z',
    paid_at: '2030-01-01T00:01:00Z',
    ship_name: 'Sam Lee',
    ship_email: 'sam@example.com',
    ship_phone: '+1',
    ship_address: '1 Test Street',
    ship_state: 'Lagos State',
    ship_city: 'City',
    ship_courier: 'Shipbubble',
    items: [
      {
        product_id: ID,
        title: 'Desk lamp',
        image_url: null,
        size: null,
        color: 'Red',
        unit_price_minor: 1000,
        quantity: 2,
        line_total_minor: 2000,
      },
    ],
  };

  it('maps the order and its lines', async () => {
    supabase.rpc.mockResolvedValue({ data: row, error: null });
    const order = await getOrder(ID);
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_order', { p_order_id: ID });
    expect(order).toMatchObject({
      orderNumber: 'SY-001',
      status: 'paid',
      totalMinor: 2280,
      discountMinor: 200,
      couponCode: 'SAVE10',
      shipping: { name: 'Sam Lee', city: 'City', state: 'Lagos State' },
    });
    expect(order.items).toEqual([
      {
        productId: ID,
        title: 'Desk lamp',
        imageUrl: null,
        size: null,
        color: 'Red',
        unitPriceMinor: 1000,
        quantity: 2,
        lineTotalMinor: 2000,
      },
    ]);
  });

  it('returns null when the order is not found or the id is bad', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getOrder(ID)).toBeNull();
    expect(await getOrder('nope')).toBeNull();
  });

  it('throws a friendly error on failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'secret' } });
    await expect(getOrder(ID)).rejects.toThrow("We couldn't load this order. Please try again.");
  });
});

describe('isPaidStatus', () => {
  it('counts paid, shipped and delivered only', () => {
    expect(['paid', 'shipped', 'delivered'].every(isPaidStatus)).toBe(true);
    expect(isPaidStatus('pending_payment')).toBe(false);
    expect(isPaidStatus('cancelled')).toBe(false);
  });
});
