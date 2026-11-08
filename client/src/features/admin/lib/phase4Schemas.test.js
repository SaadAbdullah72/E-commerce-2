import { describe, expect, it } from 'vitest';

import { bannerSchema, EMPTY_BANNER_VALUES, toBannerRow } from './bannerSchema';
import {
  couponSchema,
  couponStatus,
  describeDiscount,
  EMPTY_COUPON_VALUES,
  toCouponRow,
} from './couponSchema';
import { fromLocalInput, toLocalInput } from './dates';

const errorsOf = (schema, values) => {
  const result = schema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
};

describe('dates', () => {
  it('round-trips a local date-time through ISO', () => {
    const iso = fromLocalInput('2030-05-06T14:30');
    expect(iso).toBe(new Date('2030-05-06T14:30').toISOString());
    expect(toLocalInput(iso)).toBe('2030-05-06T14:30');
  });

  it('treats empty or invalid text as no date', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nonsense')).toBeNull();
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('nonsense')).toBe('');
  });
});

describe('couponSchema', () => {
  const percent = (overrides = {}) => ({
    ...EMPTY_COUPON_VALUES,
    code: 'save20',
    percentOff: '20',
    ...overrides,
  });
  const fixed = (overrides = {}) => ({
    ...EMPTY_COUPON_VALUES,
    code: 'FIVE',
    discountType: 'fixed',
    amountOff: '5.00',
    ...overrides,
  });

  it('accepts a percent and a fixed coupon', () => {
    expect(couponSchema.safeParse(percent()).success).toBe(true);
    expect(couponSchema.safeParse(fixed()).success).toBe(true);
  });

  it('checks the code format', () => {
    expect(errorsOf(couponSchema, percent({ code: 'ab' })).code).toBeTruthy();
    expect(errorsOf(couponSchema, percent({ code: 'has space' })).code).toBeTruthy();
    expect(errorsOf(couponSchema, percent({ code: 'x'.repeat(31) })).code).toBeTruthy();
    expect(couponSchema.safeParse(percent({ code: 'SPRING-2030_A' })).success).toBe(true);
  });

  it('needs a percent from 1 to 100 for a percent coupon', () => {
    for (const bad of ['', '0', '101', '12.5', '-5', 'abc']) {
      expect(errorsOf(couponSchema, percent({ percentOff: bad })).percentOff).toBeTruthy();
    }
    expect(couponSchema.safeParse(percent({ percentOff: '100' })).success).toBe(true);
  });

  it('checks the optional highest-discount cap', () => {
    expect(errorsOf(couponSchema, percent({ maxDiscount: 'abc' })).maxDiscount).toBeTruthy();
    expect(errorsOf(couponSchema, percent({ maxDiscount: '0' })).maxDiscount).toBeTruthy();
    expect(couponSchema.safeParse(percent({ maxDiscount: '10.00' })).success).toBe(true);
  });

  it('needs a positive amount for a fixed coupon', () => {
    for (const bad of ['', '0', '-1', '1.234', 'x']) {
      expect(errorsOf(couponSchema, fixed({ amountOff: bad })).amountOff).toBeTruthy();
    }
  });

  it('ignores the fields of the other type', () => {
    expect(couponSchema.safeParse(percent({ amountOff: 'garbage' })).success).toBe(true);
    expect(couponSchema.safeParse(fixed({ percentOff: 'garbage' })).success).toBe(true);
  });

  it('checks dates, limits and the minimum order', () => {
    expect(
      errorsOf(
        couponSchema,
        percent({ startsAt: '2030-02-01T10:00', expiresAt: '2030-01-01T10:00' }),
      ).expiresAt,
    ).toMatch(/after the start/);
    expect(errorsOf(couponSchema, percent({ usageLimit: '0' })).usageLimit).toBeTruthy();
    expect(errorsOf(couponSchema, percent({ usageLimit: '1.5' })).usageLimit).toBeTruthy();
    expect(couponSchema.safeParse(percent({ usageLimit: '' })).success).toBe(true);
    expect(errorsOf(couponSchema, percent({ perUserLimit: '0' })).perUserLimit).toBeTruthy();
    expect(errorsOf(couponSchema, percent({ minSubtotal: '-1' })).minSubtotal).toBeTruthy();
  });
});

describe('toCouponRow', () => {
  it('builds a percent row: uppercase code, cents, nulls for the unused fields', () => {
    const row = toCouponRow({
      code: ' save20 ',
      discountType: 'percent',
      percentOff: '20',
      amountOff: '99',
      maxDiscount: '10.00',
      minSubtotal: '25.50',
      startsAt: '',
      expiresAt: '2030-01-01T10:00',
      usageLimit: '100',
      perUserLimit: '2',
      isActive: true,
    });
    expect(row).toEqual({
      code: 'SAVE20',
      discount_type: 'percent',
      percent_off: 20,
      amount_off_minor: null,
      max_discount_minor: 1000,
      min_subtotal_minor: 2550,
      starts_at: null,
      expires_at: new Date('2030-01-01T10:00').toISOString(),
      usage_limit: 100,
      per_user_limit: 2,
      is_active: true,
    });
  });

  it('builds a fixed row without a percent or a cap, and never sends used_count', () => {
    const row = toCouponRow({
      ...EMPTY_COUPON_VALUES,
      code: 'five',
      discountType: 'fixed',
      percentOff: '50',
      amountOff: '5.00',
      maxDiscount: '3.00',
    });
    expect(row).toMatchObject({
      discount_type: 'fixed',
      percent_off: null,
      amount_off_minor: 500,
      max_discount_minor: null,
      min_subtotal_minor: 0,
      usage_limit: null,
    });
    expect(row).not.toHaveProperty('used_count');
  });
});

describe('describeDiscount / couponStatus', () => {
  const base = {
    discountType: 'percent',
    percentOff: 20,
    amountOffMinor: null,
    maxDiscountMinor: null,
    isActive: true,
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    usedCount: 0,
  };
  const now = new Date('2030-06-01T12:00:00Z');

  it('describes both types', () => {
    expect(describeDiscount(base)).toBe('20% off');
    expect(describeDiscount({ ...base, maxDiscountMinor: 1000 })).toBe('20% off (up to $10.00)');
    expect(describeDiscount({ ...base, discountType: 'fixed', amountOffMinor: 500 })).toBe(
      '$5.00 off',
    );
  });

  it('works out where a coupon is right now', () => {
    expect(couponStatus(base, now)).toBe('live');
    expect(couponStatus({ ...base, isActive: false }, now)).toBe('paused');
    expect(couponStatus({ ...base, startsAt: '2030-07-01T00:00:00Z' }, now)).toBe('scheduled');
    expect(couponStatus({ ...base, expiresAt: '2030-05-01T00:00:00Z' }, now)).toBe('expired');
    expect(couponStatus({ ...base, usageLimit: 5, usedCount: 5 }, now)).toBe('used-up');
    expect(couponStatus({ ...base, usageLimit: 5, usedCount: 4 }, now)).toBe('live');
    // A paused coupon stays "paused" even if it has also expired.
    expect(couponStatus({ ...base, isActive: false, expiresAt: '2030-05-01T00:00:00Z' }, now)).toBe(
      'paused',
    );
  });
});

describe('bannerSchema / toBannerRow', () => {
  const hero = (overrides = {}) => ({
    ...EMPTY_BANNER_VALUES,
    title: 'UP TO 90% OFF',
    ...overrides,
  });
  const image = {
    url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/banners/a.jpg',
    publicId: 'shopyaro/banners/a',
    alt: '',
  };

  it('needs a title and allows everything else to be empty', () => {
    expect(errorsOf(bannerSchema, hero({ title: '  ' })).title).toBeTruthy();
    expect(bannerSchema.safeParse(hero()).success).toBe(true);
  });

  it('only allows internal links', () => {
    for (const ok of ['/', '/category/electronics', '/product/x?ref=hero']) {
      expect(bannerSchema.safeParse(hero({ linkPath: ok })).success).toBe(true);
    }
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      'category/x',
      '/a//b',
      '/<script>',
    ]) {
      expect(errorsOf(bannerSchema, hero({ linkPath: bad })).linkPath).toBeTruthy();
    }
  });

  it('does not allow a button without a link', () => {
    expect(errorsOf(bannerSchema, hero({ buttonText: 'Shop' })).linkPath).toMatch(/link/i);
    expect(bannerSchema.safeParse(hero({ buttonText: 'Shop', linkPath: '/' })).success).toBe(true);
  });

  it('checks lengths, theme, order, dates and the picture folder', () => {
    expect(errorsOf(bannerSchema, hero({ title: 'x'.repeat(121) })).title).toBeTruthy();
    expect(errorsOf(bannerSchema, hero({ badge: 'x'.repeat(41) })).badge).toBeTruthy();
    expect(errorsOf(bannerSchema, hero({ subtitle: 'x'.repeat(161) })).subtitle).toBeTruthy();
    expect(
      errorsOf(bannerSchema, hero({ buttonText: 'x'.repeat(31), linkPath: '/' })).buttonText,
    ).toBeTruthy();
    expect(errorsOf(bannerSchema, hero({ theme: 'neon' })).theme).toBeTruthy();
    expect(errorsOf(bannerSchema, hero({ sortOrder: '1001' })).sortOrder).toBeTruthy();
    expect(errorsOf(bannerSchema, hero({ sortOrder: '-1' })).sortOrder).toBeTruthy();
    expect(
      errorsOf(bannerSchema, hero({ startsAt: '2030-02-01T10:00', endsAt: '2030-01-01T10:00' }))
        .endsAt,
    ).toBeTruthy();
    expect(
      errorsOf(bannerSchema, hero({ image: [{ ...image, publicId: 'shopyaro/products/a' }] }))
        .image,
    ).toBeTruthy();
    expect(bannerSchema.safeParse(hero({ image: [image] })).success).toBe(true);
  });

  it('builds a hero row with its picture', () => {
    const row = toBannerRow(
      hero({
        badge: ' NEW ',
        subtitle: 'Sub',
        buttonText: 'Shop',
        linkPath: '/',
        theme: 'sunset',
        sortOrder: '2',
        image: [image],
      }),
      'hero',
    );
    expect(row).toEqual({
      kind: 'hero',
      title: 'UP TO 90% OFF',
      badge: 'NEW',
      subtitle: 'Sub',
      button_text: 'Shop',
      link_path: '/',
      image_url: image.url,
      image_public_id: image.publicId,
      theme: 'sunset',
      sort_order: 2,
      is_active: true,
      starts_at: null,
      ends_at: null,
    });
  });

  it('clears the hero-only fields for an announcement, as the database requires', () => {
    const row = toBannerRow(
      hero({ badge: 'x', subtitle: 'y', buttonText: 'z', linkPath: '/sale', image: [image] }),
      'announcement',
    );
    expect(row).toMatchObject({
      kind: 'announcement',
      badge: null,
      subtitle: null,
      button_text: null,
      image_url: null,
      image_public_id: null,
      link_path: '/sale',
    });
  });
});
