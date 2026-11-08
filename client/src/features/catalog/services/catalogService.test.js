import { beforeEach, describe, expect, it, vi } from 'vitest';

import { electronics, lightning, productRow } from '@/test/fixtures/catalog';

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { getProductBySlug, listCategories, listDealTags, listProducts } from './catalogService';

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

describe('listProducts', () => {
  it('reads active products with their category, images and deal tags, newest first', async () => {
    const query = fakeQuery({ data: [productRow()], error: null });
    supabase.from.mockReturnValue(query);

    const products = await listProducts();

    expect(supabase.from).toHaveBeenCalledWith('products');
    const select = callsOf(query, 'select')[0][1][0];
    expect(select).toContain('category:categories');
    expect(select).toContain('images:product_images');
    expect(select).toContain('product_deal_tags(');
    expect(select).not.toContain('!inner');
    expect(callsOf(query, 'order')[0][1]).toEqual(['created_at', { ascending: false }]);
    expect(callsOf(query, 'limit')[0][1]).toEqual([200]);
    expect(products[0]).toMatchObject({ slug: 'wireless-bluetooth-earbuds', price: 12.99 });
  });

  it('filters by category id', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ categoryId: 'cat-1' });

    expect(callsOf(query, 'eq')[0][1]).toEqual(['category_id', 'cat-1']);
  });

  it('filters by deal tag with an inner join', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ dealTagId: 'tag-1' });

    expect(callsOf(query, 'select')[0][1][0]).toContain('product_deal_tags!inner');
    expect(callsOf(query, 'eq')[0][1]).toEqual(['product_deal_tags.deal_tag_id', 'tag-1']);
  });

  it('filters by maximum price', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ maxPriceMinor: 500 });

    expect(callsOf(query, 'lte')[0][1]).toEqual(['price_minor', 500]);
  });

  it('searches titles and escapes LIKE wildcards typed by the user', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ keyword: '  50%_off\\ ' });

    expect(callsOf(query, 'ilike')[0][1]).toEqual(['title', '%50\\%\\_off\\\\%']);
  });

  it('caps the length of the search text', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ keyword: 'a'.repeat(500) });

    expect(callsOf(query, 'ilike')[0][1][1]).toBe(`%${'a'.repeat(100)}%`);
  });

  it('ignores an empty search', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listProducts({ keyword: '   ' });

    expect(callsOf(query, 'ilike')).toHaveLength(0);
  });

  it('throws a friendly error and never exposes the database message', async () => {
    supabase.from.mockReturnValue(
      fakeQuery({ data: null, error: { message: 'permission denied for table secrets' } }),
    );

    const failure = await listProducts().catch((error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe("We couldn't load the products. Please try again.");
    expect(failure.message).not.toContain('secrets');
  });
});

describe('getProductBySlug', () => {
  it('returns the mapped product', async () => {
    const query = fakeQuery({ data: productRow(), error: null });
    supabase.from.mockReturnValue(query);

    const product = await getProductBySlug('wireless-bluetooth-earbuds');

    expect(callsOf(query, 'eq')[0][1]).toEqual(['slug', 'wireless-bluetooth-earbuds']);
    expect(product).toMatchObject({ id: 'prod-1', title: expect.any(String) });
  });

  it('returns null when nothing matches', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: null }));
    expect(await getProductBySlug('missing')).toBeNull();
  });

  it('returns null for a malformed slug without calling the database', async () => {
    expect(await getProductBySlug("x'; drop table products;--")).toBeNull();
    expect(await getProductBySlug('')).toBeNull();
    expect(await getProductBySlug(undefined)).toBeNull();
    expect(await getProductBySlug('a'.repeat(200))).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws a friendly error on a database failure', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'boom' } }));
    await expect(getProductBySlug('ok-slug')).rejects.toThrow(/couldn't load this product/);
  });
});

describe('listCategories / listDealTags', () => {
  it('map their rows, ordered by sort_order', async () => {
    const categoryQuery = fakeQuery({ data: [electronics], error: null });
    supabase.from.mockReturnValueOnce(categoryQuery);
    expect(await listCategories()).toEqual([
      { id: 'cat-1', name: 'Electronics', slug: 'electronics', iconUrl: null },
    ]);
    expect(callsOf(categoryQuery, 'order')[0][1]).toEqual(['sort_order', { ascending: true }]);

    supabase.from.mockReturnValueOnce(fakeQuery({ data: [lightning], error: null }));
    expect(await listDealTags()).toEqual([lightning]);
  });

  it('throw friendly errors on failure', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'x' } }));
    await expect(listCategories()).rejects.toThrow(/couldn't load the categories/);
    await expect(listDealTags()).rejects.toThrow(/couldn't load the deals/);
  });
});
