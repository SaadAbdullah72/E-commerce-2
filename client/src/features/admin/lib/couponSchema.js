import { z } from 'zod';

import { formatMoney } from '@/shared/lib/formatMoney';

import { fromLocalInput } from './dates';
import { parseMoneyToMinor } from './money';

const WHOLE_NUMBER = /^\d+$/;

/**
 * The coupon form, as typed. Money fields are dollars ("5.00"); `toCouponRow` converts them
 * to whole cents. The database checks every rule again (see the coupons constraints).
 */
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,30}$/, 'Use 3 to 30 letters, numbers, hyphens or underscores'),
    discountType: z.enum(['percent', 'fixed']),
    percentOff: z.string().trim(),
    amountOff: z.string().trim(),
    maxDiscount: z.string().trim(),
    minSubtotal: z.string().trim(),
    startsAt: z.string(),
    expiresAt: z.string(),
    usageLimit: z.string().trim(),
    perUserLimit: z.string().trim(),
    isActive: z.boolean(),
  })
  .superRefine((values, context) => {
    const problem = (path, message) => context.addIssue({ code: 'custom', path: [path], message });

    if (values.discountType === 'percent') {
      const percent = WHOLE_NUMBER.test(values.percentOff) ? Number(values.percentOff) : NaN;
      if (!(percent >= 1 && percent <= 100))
        problem('percentOff', 'Enter a whole number from 1 to 100');
      if (values.maxDiscount !== '') {
        const cap = parseMoneyToMinor(values.maxDiscount);
        if (cap === null || cap < 1)
          problem('maxDiscount', 'Enter an amount like 10.00, or leave empty');
      }
    } else {
      const amount = parseMoneyToMinor(values.amountOff);
      if (amount === null || amount < 1) problem('amountOff', 'Enter an amount like 5.00');
    }

    if (parseMoneyToMinor(values.minSubtotal === '' ? '0' : values.minSubtotal) === null) {
      problem('minSubtotal', 'Enter an amount like 20.00, or 0 for no minimum');
    }

    const starts = fromLocalInput(values.startsAt);
    const expires = fromLocalInput(values.expiresAt);
    if (values.startsAt && !starts) problem('startsAt', 'Enter a valid start date');
    if (values.expiresAt && !expires) problem('expiresAt', 'Enter a valid expiry date');
    if (starts && expires && expires <= starts)
      problem('expiresAt', 'Expiry must be after the start');

    if (values.usageLimit !== '') {
      const limit = WHOLE_NUMBER.test(values.usageLimit) ? Number(values.usageLimit) : NaN;
      if (!(limit >= 1 && limit <= 1_000_000)) {
        problem('usageLimit', 'Enter a whole number from 1 to 1,000,000, or leave empty');
      }
    }

    const perUser = WHOLE_NUMBER.test(values.perUserLimit) ? Number(values.perUserLimit) : NaN;
    if (!(perUser >= 1 && perUser <= 1000))
      problem('perUserLimit', 'Enter a whole number from 1 to 1000');
  });

/**
 * Validated form values -> the row to save. Fields that do not apply to the chosen type are
 * sent as null so the database constraint is satisfied. `used_count` is never sent.
 */
export function toCouponRow(values) {
  const isPercent = values.discountType === 'percent';
  return {
    code: values.code.trim().toUpperCase(),
    discount_type: values.discountType,
    percent_off: isPercent ? Number(values.percentOff) : null,
    amount_off_minor: isPercent ? null : parseMoneyToMinor(values.amountOff),
    max_discount_minor:
      isPercent && values.maxDiscount !== '' ? parseMoneyToMinor(values.maxDiscount) : null,
    min_subtotal_minor: parseMoneyToMinor(values.minSubtotal === '' ? '0' : values.minSubtotal),
    starts_at: fromLocalInput(values.startsAt),
    expires_at: fromLocalInput(values.expiresAt),
    usage_limit: values.usageLimit === '' ? null : Number(values.usageLimit),
    per_user_limit: Number(values.perUserLimit),
    is_active: values.isActive,
  };
}

export const EMPTY_COUPON_VALUES = {
  code: '',
  discountType: 'percent',
  percentOff: '',
  amountOff: '',
  maxDiscount: '',
  minSubtotal: '0',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  perUserLimit: '1',
  isActive: true,
};

/** "20% off (up to $10.00)" / "$5.00 off" */
export function describeDiscount(coupon) {
  if (coupon.discountType === 'percent') {
    const cap = coupon.maxDiscountMinor ? ` (up to ${formatMoney(coupon.maxDiscountMinor)})` : '';
    return `${coupon.percentOff}% off${cap}`;
  }
  return `${formatMoney(coupon.amountOffMinor)} off`;
}

/**
 * Where a coupon is right now.
 * @returns {'paused' | 'scheduled' | 'expired' | 'used-up' | 'live'}
 */
export function couponStatus(coupon, now = new Date()) {
  if (!coupon.isActive) return 'paused';
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return 'scheduled';
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= now) return 'expired';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'used-up';
  return 'live';
}
