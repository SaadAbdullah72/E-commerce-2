import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  ADMIN_ORDERS_PAGE_SIZE,
  cleanOrderSearch,
  friendlyOrderError,
  getAdminOrder,
  getOrderStats,
  listAdminOrders,
  updateAdminOrder,
} from './orderAdminService';

function fakeQuery(result) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'calls') return calls;
        if (name === 'then')
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        return (...args) => {
          calls.push([name, args]);
          return query;
        };
      },
    },
  );
  return query;
}
const callsOf = (query, name) => query.calls.filter(([method]) => method === name);

const ID = '11111111-1111-4111-8111-111111111111';
const STAMP = '2030-01-01T10:00:00.123456+00:00';

const row = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  order_number: `SY-${n}`,
  status: 'paid',
  currency: 'USD',
  total_minor: 1500,
  ship_name: 'Sam Lee',
  ship_email: 'sam@example.com',
  payment_issue: null,
  tracking_number: null,
  created_at: STAMP,
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe('cleanOrderSearch', () => {
  it('keeps order numbers and email characters, drops filter syntax', () => {
    expect(cleanOrderSearch('SY-1234')).toBe('SY-1234');
    expect(cleanOrderSearch('Sam.Lee+x@Example.com')).toBe('Sam.Lee+x@Example.com');
    expect(cleanOrderSearch('a,b(c)%d_e*f"g\'h')).toBe('a b c d e f g h');
    expect(cleanOrderSearch('x'.repeat(100))).toHaveLength(60);
    expect(cleanOrderSearch(null)).toBe('');
  });
});

describe('listAdminOrders', () => {
  it('asks for named columns only (never select *, never Stripe ids)', async () => {
    const query = fakeQuery({ data: [row(1)], error: null });
    supabase.from.mockReturnValue(query);
    await listAdminOrders();

    expect(supabase.from).toHaveBeenCalledWith('orders');
    const columns = callsOf(query, 'select')[0][1][0];
    expect(columns).not.toContain('*');
    expect(columns).not.toMatch(/stripe/);
    expect(columns).toContain('payment_issue');
  });

  it('maps rows, and says whether another page exists with the exact cursor text', async () => {
    const rows = Array.from({ length: ADMIN_ORDERS_PAGE_SIZE + 1 }, (_, i) => row(i + 1));
    supabase.from.mockReturnValue(fakeQuery({ data: rows, error: null }));

    const page = await listAdminOrders();
    expect(page.orders).toHaveLength(ADMIN_ORDERS_PAGE_SIZE);
    expect(page.orders[0]).toMatchObject({
      orderNumber: 'SY-1',
      customerName: 'Sam Lee',
      customerEmail: 'sam@example.com',
      totalMinor: 1500,
      paymentIssue: null,
    });
    expect(page.nextCursor).toEqual({
      createdAt: STAMP, // the database's own text, not a rounded Date
      id: rows[ADMIN_ORDERS_PAGE_SIZE - 1].id,
    });
  });

  it('has no next cursor on the last page', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: [row(1), row(2)], error: null }));
    expect((await listAdminOrders()).nextCursor).toBeNull();
  });

  it('applies the status, needs-refund and search filters', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);
    await listAdminOrders({ status: 'paid', needsRefund: true, search: 'sam,(x)' });

    expect(callsOf(query, 'eq')).toEqual([['eq', ['status', 'paid']]]);
    expect(callsOf(query, 'not')).toEqual([['not', ['payment_issue', 'is', null]]]);
    expect(callsOf(query, 'or')).toEqual([
      ['or', ['order_number.ilike.%sam x%,ship_email.ilike.%sam x%']],
    ]);
  });

  it('ignores an unknown status', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);
    await listAdminOrders({ status: 'processing' });
    expect(callsOf(query, 'eq')).toHaveLength(0);
  });

  it('continues after the cursor: older, or the same moment with a smaller id', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);
    await listAdminOrders({ cursor: { createdAt: STAMP, id: ID } });

    expect(callsOf(query, 'or')[0][1][0]).toBe(
      `created_at.lt.${STAMP},and(created_at.eq.${STAMP},id.lt.${ID})`,
    );
  });

  it('refuses a cursor that is not a database timestamp and uuid', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: [], error: null }));
    await expect(
      listAdminOrders({ cursor: { createdAt: '2030-01-01),id.gt.0', id: ID } }),
    ).rejects.toThrow(/couldn.t load the orders/i);
    await expect(
      listAdminOrders({ cursor: { createdAt: STAMP, id: 'not-a-uuid' } }),
    ).rejects.toThrow(/couldn.t load the orders/i);
  });

  it('throws a plain message on a database error', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'raw sql text' } }));
    await expect(listAdminOrders()).rejects.toThrow(
      "We couldn't load the orders. Please try again.",
    );
  });
});

describe('getAdminOrder', () => {
  it('maps the whole order, including the Stripe ids', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: ID,
        order_number: 'SY-1',
        status: 'paid',
        cancel_reason: null,
        payment_issue: 'paid_after_cancel',
        currency: 'USD',
        subtotal_minor: 1000,
        discount_minor: 100,
        delivery_fee_minor: 500,
        total_minor: 1400,
        coupon_code: 'SAVE',
        account_email: 'acct@example.com',
        ship_name: 'Sam',
        ship_email: 'sam@example.com',
        ship_phone: '+1',
        ship_address: '1 St',
        ship_state: 'S',
        ship_city: 'C',
        ship_courier: 'DHL',
        ship_notes: 'ring',
        tracking_number: 'T1',
        stripe_session_id: 'cs_1',
        stripe_payment_intent_id: 'pi_1',
        created_at: STAMP,
        paid_at: STAMP,
        shipped_at: null,
        delivered_at: null,
        cancelled_at: null,
        expires_at: null,
        items: [
          {
            product_id: 'p1',
            title: 'Earbuds',
            image_url: null,
            size: 'M',
            color: 'Red',
            unit_price_minor: 500,
            quantity: 2,
            line_total_minor: 1000,
          },
        ],
      },
      error: null,
    });

    const order = await getAdminOrder(ID);
    expect(supabase.rpc).toHaveBeenCalledWith('admin_get_order', { p_order_id: ID });
    expect(order).toMatchObject({
      orderNumber: 'SY-1',
      paymentIssue: 'paid_after_cancel',
      accountEmail: 'acct@example.com',
      stripePaymentIntentId: 'pi_1',
      stripeSessionId: 'cs_1',
      trackingNumber: 'T1',
      shipping: { name: 'Sam', courier: 'DHL', notes: 'ring' },
    });
    expect(order.items[0]).toMatchObject({ title: 'Earbuds', quantity: 2, lineTotalMinor: 1000 });
  });

  it('is null for an order that does not exist, and never asks for a malformed id', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getAdminOrder(ID)).toBeNull();
    supabase.rpc.mockClear();
    expect(await getAdminOrder('nope')).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws a plain message on error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getAdminOrder(ID)).rejects.toThrow(/couldn.t load this order/i);
  });
});

describe('updateAdminOrder', () => {
  const result = {
    id: ID,
    status: 'shipped',
    tracking_number: 'T1',
    shipped_at: STAMP,
    delivered_at: null,
    changed: true,
  };

  it('sends the status and tracking, and maps the answer', async () => {
    supabase.rpc.mockResolvedValue({ data: result, error: null });
    const out = await updateAdminOrder(ID, { status: 'shipped', tracking: 'T1' });

    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_order', {
      p_order_id: ID,
      p_status: 'shipped',
      p_tracking: 'T1',
    });
    expect(out).toEqual({
      id: ID,
      status: 'shipped',
      trackingNumber: 'T1',
      shippedAt: STAMP,
      deliveredAt: null,
      changed: true,
    });
  });

  it('sends nulls for "leave as it is" and an empty string to remove the tracking number', async () => {
    supabase.rpc.mockResolvedValue({ data: { ...result, changed: false }, error: null });
    await updateAdminOrder(ID, { status: 'delivered' });
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({
      p_status: 'delivered',
      p_tracking: null,
    });

    await updateAdminOrder(ID, { tracking: '' });
    expect(supabase.rpc.mock.calls[1][1]).toMatchObject({ p_status: null, p_tracking: '' });
  });

  it('does not call the database for an invalid tracking number or id', async () => {
    await expect(updateAdminOrder(ID, { tracking: 'x'.repeat(101) })).rejects.toThrow(
      /tracking number is not valid/i,
    );
    await expect(updateAdminOrder(ID, { tracking: `a${String.fromCharCode(7)}` })).rejects.toThrow(
      /tracking number is not valid/i,
    );
    await expect(updateAdminOrder('nope', { status: 'shipped' })).rejects.toThrow(
      /no longer exists/i,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [
      { code: 'P0001', message: 'invalid_transition', details: 'shipped' },
      /cannot be moved that way \(it is currently "Shipped"\)/,
    ],
    [{ code: 'P0001', message: 'invalid_tracking', details: '' }, /tracking number is not valid/],
    [{ code: 'P0002', message: 'order_not_found' }, /no longer exists/],
    [{ code: '42501', message: 'permission denied' }, /do not have permission/],
    [{ code: 'XX000', message: 'raw database text' }, /could not update the order/],
  ])('shows a plain message for %j', async (error, expected) => {
    supabase.rpc.mockResolvedValue({ data: null, error });
    const failure = await updateAdminOrder(ID, { status: 'shipped' }).catch((e) => e);
    expect(failure.message).toMatch(expected);
    expect(failure.message).not.toMatch(/raw database text|invalid_transition/);
  });
});

describe('friendlyOrderError', () => {
  it('copes with a missing error and an unknown current status', () => {
    expect(friendlyOrderError(null)).toMatch(/could not update the order/);
    expect(friendlyOrderError({ message: 'invalid_transition' })).toMatch(
      /^This order cannot be moved that way\./,
    );
  });
});

describe('getOrderStats', () => {
  const good = {
    by_status: { pending_payment: 0, paid: 1, shipped: 0, delivered: 0, cancelled: 0 },
    to_ship: 1,
    needs_refund: 0,
    revenue: [],
    daily: [],
    top_products: [],
  };

  it('returns parsed stats', async () => {
    supabase.rpc.mockResolvedValue({ data: good, error: null });
    const stats = await getOrderStats();
    expect(supabase.rpc).toHaveBeenCalledWith('admin_order_stats');
    expect(stats.toShip).toBe(1);
  });

  it('throws a plain message for a database error or malformed data', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(getOrderStats()).rejects.toThrow(/couldn.t load the order numbers/i);
    supabase.rpc.mockResolvedValue({ data: { ...good, to_ship: null }, error: null });
    await expect(getOrderStats()).rejects.toThrow(/couldn.t load the order numbers/i);
  });
});
