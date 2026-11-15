import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), functions: { invoke: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { deleteBanner } from './bannerAdminService';
import { deleteCategory } from './categoryAdminService';
import { deleteCoupon } from './couponAdminService';
import { deleteProduct } from './productAdminService';
import { friendlyDeleteError } from './saveErrors';
import { requestAssetCleanup } from './uploadService';

const ID = '11111111-1111-4111-8111-111111111111';

/** Records the chained calls and resolves with `result` at the end of the chain. */
function fakeDelete(result) {
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

beforeEach(() => vi.resetAllMocks());

const CASES = [
  ['product', deleteProduct, 'products'],
  ['category', deleteCategory, 'categories'],
  ['coupon', deleteCoupon, 'coupons'],
  ['banner', deleteBanner, 'site_banners'],
];

describe.each(CASES)('delete %s', (what, remove, table) => {
  it('deletes the one row by id and confirms a row was removed', async () => {
    const query = fakeDelete({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValue(query);

    await expect(remove(ID)).resolves.toBeUndefined();

    expect(supabase.from).toHaveBeenCalledWith(table);
    expect(query.calls).toEqual([
      ['delete', []],
      ['eq', ['id', ID]],
      ['select', ['id']],
    ]);
  });

  it('treats "nothing was deleted" as a permission failure, not a success', async () => {
    supabase.from.mockReturnValue(fakeDelete({ data: [], error: null }));
    await expect(remove(ID)).rejects.toThrow(`You do not have permission to delete this ${what}.`);
  });

  it('never shows raw database text on an unexpected error', async () => {
    supabase.from.mockReturnValue(
      fakeDelete({ data: null, error: { code: 'XX000', message: 'secret internals' } }),
    );
    const error = await remove(ID).catch((caught) => caught);
    expect(error.message).toBe(`We could not delete the ${what}. Please try again.`);
    expect(error.message).not.toMatch(/secret/);
  });
});

describe('friendlyDeleteError', () => {
  it('explains a product that has been ordered', () => {
    expect(friendlyDeleteError({ code: '23503' }, 'product')).toBe(
      'Cannot delete this product because it has associated orders. Please deactivate it instead.',
    );
  });

  it('explains a category that still has products, including inactive ones', () => {
    expect(friendlyDeleteError({ code: '23503' }, 'category')).toBe(
      'Cannot delete this category because it still has products, including inactive ones. Move or delete them first.',
    );
  });

  it('explains a used coupon only for our own trigger message', () => {
    const guard = {
      code: '23514',
      message: 'A coupon that has been used cannot be deleted. Pause it instead.',
    };
    expect(friendlyDeleteError(guard, 'coupon')).toBe(
      'Cannot delete a used coupon. Pause it instead.',
    );
    expect(friendlyDeleteError({ code: '23514', message: 'something else' }, 'coupon')).toMatch(
      /could not delete the coupon/,
    );
  });

  it('maps a permission error and falls back safely', () => {
    expect(friendlyDeleteError({ code: '42501' }, 'banner')).toMatch(/permission/);
    expect(friendlyDeleteError({ code: '23503' }, 'banner')).toMatch(/could not delete the banner/);
  });
});

describe('requestAssetCleanup', () => {
  it('calls the cleanup function with nothing to delete (the server uses its own queue)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { deleted: 1, failed: 0 }, error: null });
    await requestAssetCleanup();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-assets', { body: {} });
  });

  it('never throws, so a failed cleanup cannot break a save or delete', async () => {
    supabase.functions.invoke.mockRejectedValue(new Error('offline'));
    await expect(requestAssetCleanup()).resolves.toBeUndefined();
  });
});
