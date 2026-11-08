import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  COUNT_NAMES,
  getCount,
  listAdminCategories,
  listAdminProducts,
  listLowStockProducts,
} from './adminService';

/** A chainable stand-in for the Supabase query builder that records every call. */
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

beforeEach(() => vi.resetAllMocks());

describe('getCount', () => {
  it('asks only for a count, not rows', async () => {
    const query = fakeQuery({ count: 7, error: null });
    supabase.from.mockReturnValue(query);

    expect(await getCount('activeProducts')).toBe(7);

    expect(supabase.from).toHaveBeenCalledWith('products');
    expect(callsOf(query, 'select')[0][1]).toEqual(['id', { count: 'exact', head: true }]);
    expect(callsOf(query, 'eq')[0][1]).toEqual(['is_active', true]);
  });

  it('counts inactive products, categories and customers from the right tables', async () => {
    const inactive = fakeQuery({ count: 1, error: null });
    supabase.from.mockReturnValueOnce(inactive);
    await getCount('inactiveProducts');
    expect(callsOf(inactive, 'eq')[0][1]).toEqual(['is_active', false]);

    supabase.from.mockReturnValueOnce(fakeQuery({ count: 2, error: null }));
    await getCount('categories');
    expect(supabase.from).toHaveBeenLastCalledWith('categories');

    supabase.from.mockReturnValueOnce(fakeQuery({ count: 3, error: null }));
    await getCount('customers');
    expect(supabase.from).toHaveBeenLastCalledWith('profiles');
  });

  it('defines low and out-of-stock as active products in the right range', async () => {
    const low = fakeQuery({ count: 2, error: null });
    supabase.from.mockReturnValueOnce(low);
    await getCount('lowStock');
    expect(callsOf(low, 'gte')[0][1]).toEqual(['stock', 1]);
    expect(callsOf(low, 'lte')[0][1]).toEqual(['stock', 5]);

    const out = fakeQuery({ count: 0, error: null });
    supabase.from.mockReturnValueOnce(out);
    expect(await getCount('outOfStock')).toBe(0);
    expect(callsOf(out, 'eq').map(([, args]) => args)).toEqual([
      ['is_active', true],
      ['stock', 0],
    ]);
  });

  it('throws instead of returning 0 when the query fails', async () => {
    supabase.from.mockReturnValue(fakeQuery({ count: null, error: { message: 'secret detail' } }));
    const failure = await getCount('categories').catch((error) => error);
    expect(failure.message).toMatch(/couldn.t load/i);
    expect(failure.message).not.toMatch(/secret detail/);
  });

  it('throws when no count comes back', async () => {
    supabase.from.mockReturnValue(fakeQuery({ count: null, error: null }));
    await expect(getCount('categories')).rejects.toThrow();
  });

  it('rejects unknown names', async () => {
    await expect(getCount('revenue')).rejects.toThrow(/unknown/i);
    expect(COUNT_NAMES).toContain('customers');
  });
});

describe('listLowStockProducts', () => {
  it('reads active products at or under the threshold, lowest first', async () => {
    const query = fakeQuery({
      data: [{ id: 'a', slug: 's', title: 'T', stock: 0, extra: 'x' }],
      error: null,
    });
    supabase.from.mockReturnValue(query);

    const result = await listLowStockProducts();

    expect(callsOf(query, 'eq')[0][1]).toEqual(['is_active', true]);
    expect(callsOf(query, 'lte')[0][1]).toEqual(['stock', 5]);
    expect(callsOf(query, 'order')[0][1]).toEqual(['stock', { ascending: true }]);
    expect(result).toEqual([{ id: 'a', slug: 's', title: 'T', stock: 0 }]);
  });
});

describe('listAdminProducts', () => {
  it('does not filter on is_active, so inactive products are included', async () => {
    const query = fakeQuery({
      data: [
        {
          id: 'p',
          slug: 'p',
          title: 'P',
          price_minor: 1299,
          currency: 'USD',
          stock: 3,
          is_active: false,
          category: { name: 'Electronics' },
          images: [
            { url: 'b.jpg', position: 1 },
            { url: 'a.jpg', position: 0 },
          ],
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(query);

    const [product] = await listAdminProducts();

    expect(callsOf(query, 'eq')).toHaveLength(0);
    expect(product).toEqual({
      id: 'p',
      slug: 'p',
      title: 'P',
      priceMinor: 1299,
      currency: 'USD',
      stock: 3,
      isActive: false,
      category: 'Electronics',
      image: 'a.jpg',
    });
  });

  it('copes with a missing category and no images', async () => {
    supabase.from.mockReturnValue(
      fakeQuery({
        data: [
          {
            id: 'p',
            slug: 'p',
            title: 'P',
            price_minor: 1,
            currency: 'USD',
            stock: 1,
            is_active: true,
            category: null,
            images: null,
          },
        ],
        error: null,
      }),
    );
    const [product] = await listAdminProducts();
    expect(product.category).toBe('');
    expect(product.image).toBeNull();
  });

  it('throws a friendly error', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'boom' } }));
    const failure = await listAdminProducts().catch((error) => error);
    expect(failure.message).toMatch(/the products/);
    expect(failure.message).not.toMatch(/boom/);
  });
});

describe('listAdminCategories', () => {
  it('maps rows ordered by sort_order', async () => {
    const query = fakeQuery({
      data: [{ id: 'c', name: 'N', slug: 's', is_active: false, sort_order: 2, extra: 1 }],
      error: null,
    });
    supabase.from.mockReturnValue(query);

    expect(await listAdminCategories()).toEqual([
      { id: 'c', name: 'N', slug: 's', isActive: false, sortOrder: 2 },
    ]);
    expect(callsOf(query, 'order')[0][1]).toEqual(['sort_order', { ascending: true }]);
  });
});
