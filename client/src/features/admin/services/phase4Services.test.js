import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { listLiveBanners } from '@/features/banners/services/bannerService';

import {
  getAdminBanner,
  listAdminBanners,
  saveBanner,
  setBannerActive,
  swapBannerOrder,
} from './bannerAdminService';
import {
  getAdminCoupon,
  listAdminCoupons,
  saveCoupon,
  setCouponActive,
} from './couponAdminService';
import { friendlySaveError } from './saveErrors';

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

beforeEach(() => vi.resetAllMocks());

const couponRow = (overrides = {}) => ({
  id: ID,
  code: 'SAVE20',
  discount_type: 'percent',
  percent_off: 20,
  amount_off_minor: null,
  max_discount_minor: 1000,
  min_subtotal_minor: 2550,
  starts_at: null,
  expires_at: '2030-01-01T10:00:00Z',
  usage_limit: 100,
  per_user_limit: 2,
  used_count: 3,
  is_active: true,
  created_at: '2030-01-01T00:00:00Z',
  ...overrides,
});

describe('friendlySaveError for coupons and banners', () => {
  it('explains the cases an admin can fix, using only our own messages', () => {
    expect(
      friendlySaveError(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint "coupons_code_key"',
        },
        'coupon',
      ),
    ).toMatch(/coupon code already exists/);
    expect(
      friendlySaveError(
        {
          code: '23514',
          message: 'A coupon that has been used cannot change its code or discount. Pause it...',
        },
        'coupon',
      ),
    ).toMatch(/already been used/);
    expect(
      friendlySaveError(
        { code: '23514', message: 'Too many active hero banners (limit 6)' },
        'banner',
      ),
    ).toMatch(/6 active hero slides/);
    expect(
      friendlySaveError(
        { code: '23514', message: 'Too many active announcement banners (limit 10)' },
        'banner',
      ),
    ).toMatch(/10 active announcements/);
    expect(
      friendlySaveError(
        { code: '23514', message: 'new row violates check constraint "x"' },
        'banner',
      ),
    ).toMatch(/rejected/);
  });
});

describe('coupon admin service', () => {
  it('lists coupons, newest first, mapped to camelCase', async () => {
    const query = fakeQuery({ data: [couponRow()], error: null });
    supabase.from.mockReturnValue(query);

    const [coupon] = await listAdminCoupons();

    expect(supabase.from).toHaveBeenCalledWith('coupons');
    expect(callsOf(query, 'order')[0][1]).toEqual(['created_at', { ascending: false }]);
    expect(coupon).toMatchObject({ code: 'SAVE20', percentOff: 20, usedCount: 3, isActive: true });
  });

  it('shapes one coupon as form values plus its use count', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: couponRow(), error: null }));
    const result = await getAdminCoupon(ID);
    expect(result.usedCount).toBe(3);
    expect(result.values).toMatchObject({
      code: 'SAVE20',
      discountType: 'percent',
      percentOff: '20',
      amountOff: '',
      maxDiscount: '10.00',
      minSubtotal: '25.50',
      usageLimit: '100',
      perUserLimit: '2',
    });
  });

  it('returns null for a bad or unknown id', async () => {
    expect(await getAdminCoupon('nope')).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: null }));
    expect(await getAdminCoupon(ID)).toBeNull();
  });

  it('inserts without an id and updates with one', async () => {
    const insert = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(insert);
    expect(await saveCoupon(null, { code: 'A' })).toBe(ID);
    expect(callsOf(insert, 'insert')[0][1]).toEqual([{ code: 'A' }]);

    const update = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(update);
    await saveCoupon(ID, { code: 'A' });
    expect(callsOf(update, 'update')).toHaveLength(1);
    expect(callsOf(update, 'eq')[0][1]).toEqual(['id', ID]);
  });

  it('reports friendly errors and blocked writes', async () => {
    supabase.from.mockReturnValueOnce(
      fakeQuery({ data: null, error: { code: '23505', message: 'coupons_code_key' } }),
    );
    await expect(saveCoupon(null, {})).rejects.toThrow(/coupon code already exists/);
    supabase.from.mockReturnValueOnce(fakeQuery({ data: [], error: null }));
    await expect(saveCoupon(ID, {})).rejects.toThrow(/permission/);
  });

  it('pauses by flipping is_active and never deletes', async () => {
    const query = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValue(query);
    await setCouponActive(ID, false);
    expect(callsOf(query, 'update')[0][1]).toEqual([{ is_active: false }]);
    expect(callsOf(query, 'delete')).toHaveLength(0);

    supabase.from.mockReturnValue(fakeQuery({ data: [], error: null }));
    await expect(setCouponActive(ID, true)).rejects.toThrow(/resume/);
  });
});

const bannerRow = (overrides = {}) => ({
  id: ID,
  kind: 'hero',
  badge: null,
  title: 'Big sale',
  subtitle: null,
  button_text: 'Shop',
  link_path: '/',
  image_url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/banners/a.jpg',
  image_public_id: 'shopyaro/banners/a',
  theme: 'sunset',
  sort_order: 1,
  is_active: true,
  starts_at: null,
  ends_at: null,
  ...overrides,
});

describe('banner admin service', () => {
  it('lists one kind in display order, including paused ones', async () => {
    const query = fakeQuery({ data: [bannerRow()], error: null });
    supabase.from.mockReturnValue(query);

    const [banner] = await listAdminBanners('hero');

    expect(callsOf(query, 'eq')[0][1]).toEqual(['kind', 'hero']);
    expect(callsOf(query, 'eq')).toHaveLength(1); // no is_active filter
    expect(callsOf(query, 'order')[0][1]).toEqual(['sort_order', { ascending: true }]);
    expect(banner).toMatchObject({
      title: 'Big sale',
      badge: '',
      buttonText: 'Shop',
      theme: 'sunset',
    });
  });

  it('shapes one banner as form values with its kind and picture', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: bannerRow(), error: null }));
    const result = await getAdminBanner(ID);
    expect(result.kind).toBe('hero');
    expect(result.values).toMatchObject({
      title: 'Big sale',
      sortOrder: '1',
      linkPath: '/',
      image: [{ publicId: 'shopyaro/banners/a', alt: '' }],
    });
  });

  it('saves, and explains the active-banner limit when resuming fails', async () => {
    const insert = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(insert);
    await saveBanner(null, { kind: 'hero' });
    expect(callsOf(insert, 'insert')).toHaveLength(1);

    supabase.from.mockReturnValueOnce(
      fakeQuery({
        data: null,
        error: { code: '23514', message: 'Too many active hero banners (limit 6)' },
      }),
    );
    await expect(setBannerActive(ID, true)).rejects.toThrow(/6 active hero slides/);

    const pause = fakeQuery({ data: [{ id: ID }], error: null });
    supabase.from.mockReturnValueOnce(pause);
    await setBannerActive(ID, false);
    expect(callsOf(pause, 'update')[0][1]).toEqual([{ is_active: false }]);
    expect(callsOf(pause, 'delete')).toHaveLength(0);
  });

  it('swaps the order of two banners with two updates', async () => {
    const a = fakeQuery({ data: [{ id: 'a' }], error: null });
    const b = fakeQuery({ data: [{ id: 'b' }], error: null });
    supabase.from.mockReturnValueOnce(a).mockReturnValueOnce(b);

    await swapBannerOrder({ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 });

    expect(callsOf(a, 'update')[0][1]).toEqual([{ sort_order: 2 }]);
    expect(callsOf(a, 'eq')[0][1]).toEqual(['id', 'a']);
    expect(callsOf(b, 'update')[0][1]).toEqual([{ sort_order: 1 }]);
  });

  it('fails clearly if either update did not happen', async () => {
    supabase.from
      .mockReturnValueOnce(fakeQuery({ data: [{ id: 'a' }], error: null }))
      .mockReturnValueOnce(fakeQuery({ data: [], error: null }));
    await expect(
      swapBannerOrder({ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }),
    ).rejects.toThrow(/change the order/);
  });
});

describe('storefront bannerService', () => {
  it('asks for one kind in order and maps to display fields', async () => {
    const query = fakeQuery({
      data: [
        {
          id: 'x',
          badge: null,
          title: 'T',
          subtitle: null,
          button_text: null,
          link_path: null,
          image_url: null,
          theme: 'ocean',
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(query);

    const banners = await listLiveBanners('announcement');

    expect(callsOf(query, 'eq')[0][1]).toEqual(['kind', 'announcement']);
    expect(callsOf(query, 'order')[0][1]).toEqual(['sort_order', { ascending: true }]);
    expect(banners).toEqual([
      {
        id: 'x',
        badge: '',
        title: 'T',
        subtitle: '',
        buttonText: '',
        linkPath: '',
        imageUrl: null,
        theme: 'ocean',
      },
    ]);
  });

  it('throws a friendly error', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'boom' } }));
    await expect(listLiveBanners('hero')).rejects.toThrow(/couldn.t load the banners/i);
  });
});
