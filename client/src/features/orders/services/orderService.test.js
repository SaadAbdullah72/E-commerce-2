import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { cancelMyOrder, getOrderDetail, listOrders, ORDERS_PAGE_SIZE } from './orderService';

const ID = '11111111-1111-4111-8111-111111111111';

/** A query builder that records what was asked and answers like PostgREST. */
function listQuery(result) {
  const calls = { order: [], or: [], limit: null, select: null };
  const query = {
    select: vi.fn((columns) => {
      calls.select = columns;
      return query;
    }),
    order: vi.fn((column, options) => {
      calls.order.push([column, options]);
      return query;
    }),
    limit: vi.fn((n) => {
      calls.limit = n;
      return query;
    }),
    or: vi.fn((filter) => {
      calls.or.push(filter);
      return query;
    }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  supabase.from.mockReturnValue(query);
  return calls;
}

const row = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  order_number: `SY-00${n}`,
  status: 'paid',
  currency: 'USD',
  total_minor: 2280,
  created_at: `2030-01-0${n}T10:00:00.123456+00:00`,
  expires_at: '2030-01-09T10:00:00+00:00',
  cancel_reason: null,
  order_items: [
    { title: 'Lamp', image_url: null, quantity: 2 },
    { title: 'Mug', image_url: 'https://x/m.png', quantity: 1 },
  ],
  ...overrides,
});

beforeEach(() => {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
});

describe('listOrders', () => {
  it('asks for the own orders, newest first with id as tie-break, one extra row', async () => {
    const calls = listQuery({ data: [row(2), row(1)], error: null });
    await listOrders();

    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(calls.order).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(calls.limit).toBe(ORDERS_PAGE_SIZE + 1);
    expect(calls.or).toEqual([]); // first page: no cursor filter
    // Never asks for the Stripe ids or payment notes.
    expect(calls.select).not.toMatch(/stripe|payment_issue|select \*|\*/);
  });

  it('maps rows to orders with an item count', async () => {
    listQuery({ data: [row(1, { status: 'pending_payment' })], error: null });
    const { orders, nextCursor } = await listOrders();

    expect(orders).toEqual([
      {
        id: row(1).id,
        orderNumber: 'SY-001',
        status: 'pending_payment',
        currency: 'USD',
        totalMinor: 2280,
        createdAt: '2030-01-01T10:00:00.123456+00:00',
        expiresAt: '2030-01-09T10:00:00+00:00',
        cancelReason: null,
        items: [
          { title: 'Lamp', imageUrl: null, quantity: 2 },
          { title: 'Mug', imageUrl: 'https://x/m.png', quantity: 1 },
        ],
        itemCount: 3,
      },
    ]);
    expect(nextCursor).toBeNull(); // fewer rows than a page: this is the end
  });

  it('keeps the page to 10 and points the cursor at the last SHOWN order, as exact text', async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      row(1, {
        id: `00000000-0000-4000-8000-${String(100 - i).padStart(12, '0')}`,
        created_at: '2030-01-01T10:00:00.123456+00:00',
      }),
    );
    listQuery({ data: rows, error: null });
    const { orders, nextCursor } = await listOrders();

    expect(orders).toHaveLength(10);
    expect(nextCursor).toEqual({
      createdAt: '2030-01-01T10:00:00.123456+00:00', // microseconds kept, not rounded by a Date
      id: rows[9].id,
    });
  });

  it('exactly 10 rows means there is no next page', async () => {
    listQuery({
      data: Array.from({ length: 10 }, (_, i) => row(1, { id: `id-${i}` })),
      error: null,
    });
    expect((await listOrders()).nextCursor).toBeNull();
  });

  it('continues after the cursor: older, or the same moment with a smaller id', async () => {
    const calls = listQuery({ data: [], error: null });
    await listOrders({ createdAt: '2030-01-01T10:00:00.123456+00:00', id: ID });

    expect(calls.or).toEqual([
      `created_at.lt.2030-01-01T10:00:00.123456+00:00,and(created_at.eq.2030-01-01T10:00:00.123456+00:00,id.lt.${ID})`,
    ]);
  });

  it.each([
    [
      'a timestamp with filter syntax in it',
      { createdAt: '2030-01-01T10:00:00Z),id.gt.0', id: ID },
    ],
    ['a plain date string', { createdAt: 'yesterday', id: ID }],
    ['a bad id', { createdAt: '2030-01-01T10:00:00+00:00', id: '1),or(id.gt.0' }],
  ])('refuses %s instead of sending it to the database', async (_label, cursor) => {
    const calls = listQuery({ data: [], error: null });
    await expect(listOrders(cursor)).rejects.toThrow("We couldn't load your orders");
    expect(calls.or).toEqual([]);
  });

  it('throws a friendly error when the query fails', async () => {
    listQuery({ data: null, error: { message: 'secret db detail' } });
    await expect(listOrders()).rejects.toThrow("We couldn't load your orders. Please try again.");
  });

  it('handles an order without items', async () => {
    listQuery({ data: [row(1, { order_items: null })], error: null });
    const { orders } = await listOrders();
    expect(orders[0]).toMatchObject({ items: [], itemCount: 0 });
  });
});

describe('getOrderDetail', () => {
  const rpcRow = (overrides = {}) => ({
    id: ID,
    order_number: 'SY-001',
    status: 'paid',
    currency: 'USD',
    subtotal_minor: 2000,
    discount_minor: 0,
    delivery_fee_minor: 480,
    total_minor: 2480,
    created_at: '2030-01-01T00:00:00+00:00',
    paid_at: '2030-01-01T00:01:00+00:00',
    shipped_at: null,
    delivered_at: null,
    cancelled_at: null,
    expires_at: '2030-01-01T00:31:00+00:00',
    items: [],
    ...overrides,
  });

  it('returns the order with the new timeline dates and no cancel reason', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcRow(), error: null });
    const order = await getOrderDetail(ID);

    expect(supabase.rpc).toHaveBeenCalledWith('get_my_order', { p_order_id: ID });
    expect(order).toMatchObject({
      status: 'paid',
      paidAt: '2030-01-01T00:01:00+00:00',
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      expiresAt: '2030-01-01T00:31:00+00:00',
      cancelReason: null,
    });
    expect(supabase.from).not.toHaveBeenCalled(); // no extra read for a live order
  });

  it('adds why a cancelled order was cancelled', async () => {
    supabase.rpc.mockResolvedValue({
      data: rpcRow({ status: 'cancelled', cancelled_at: '2030-01-01T00:05:00+00:00' }),
      error: null,
    });
    const eq = vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: { cancel_reason: 'customer' }, error: null }),
    }));
    const select = vi.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });

    const order = await getOrderDetail(ID);

    expect(select).toHaveBeenCalledWith('cancel_reason');
    expect(eq).toHaveBeenCalledWith('id', ID);
    expect(order).toMatchObject({
      status: 'cancelled',
      cancelledAt: '2030-01-01T00:05:00+00:00',
      cancelReason: 'customer',
    });
  });

  it('still shows a cancelled order when the reason cannot be read', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcRow({ status: 'cancelled' }), error: null });
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'x' } }),
        }),
      }),
    });
    expect(await getOrderDetail(ID)).toMatchObject({ status: 'cancelled', cancelReason: null });
  });

  it("returns null for a missing order, someone else's order or a bad id", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getOrderDetail(ID)).toBeNull();
    expect(await getOrderDetail('nope')).toBeNull();
  });

  it('throws a friendly error on failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getOrderDetail(ID)).rejects.toThrow("We couldn't load this order");
  });
});

describe('cancelMyOrder', () => {
  it('cancels through the database function and says whether it worked', async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    expect(await cancelMyOrder(ID)).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_my_order', { p_order_id: ID });

    supabase.rpc.mockResolvedValue({ data: false, error: null });
    expect(await cancelMyOrder(ID)).toBe(false); // already paid or cancelled
  });

  it("says false for an order that is not the customer's, and for a bad id", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
    expect(await cancelMyOrder(ID)).toBe(false);
    expect(await cancelMyOrder('nope')).toBe(false);
  });

  it('throws a friendly error on any other failure', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'secret' } });
    await expect(cancelMyOrder(ID)).rejects.toThrow("We couldn't cancel the order.");
  });
});
