import { supabase } from '@/lib/supabase/client';

import { toLocalInput } from '../lib/dates';
import { minorToInput } from '../lib/money';
import { friendlySaveError } from './saveErrors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  'id, code, discount_type, percent_off, amount_off_minor, max_discount_minor, min_subtotal_minor, starts_at, expires_at, usage_limit, per_user_limit, used_count, is_active, created_at';

function mapCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    percentOff: row.percent_off,
    amountOffMinor: row.amount_off_minor,
    maxDiscountMinor: row.max_discount_minor,
    minSubtotalMinor: row.min_subtotal_minor,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit,
    perUserLimit: row.per_user_limit,
    usedCount: row.used_count,
    isActive: row.is_active,
  };
}

export async function listAdminCoupons() {
  const { data, error } = await supabase
    .from('coupons')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error("We couldn't load the coupons. Please try again.");
  return data.map(mapCoupon);
}

/**
 * One coupon, as form values plus its use count. Null when it does not exist.
 * @param {string} id
 */
export async function getAdminCoupon(id) {
  if (!UUID_PATTERN.test(id)) return null;
  const { data, error } = await supabase.from('coupons').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error("We couldn't load this coupon. Please try again.");
  if (!data) return null;

  const coupon = mapCoupon(data);
  return {
    usedCount: coupon.usedCount,
    values: {
      code: coupon.code,
      discountType: coupon.discountType,
      percentOff: coupon.percentOff === null ? '' : String(coupon.percentOff),
      amountOff: coupon.amountOffMinor === null ? '' : minorToInput(coupon.amountOffMinor),
      maxDiscount: coupon.maxDiscountMinor === null ? '' : minorToInput(coupon.maxDiscountMinor),
      minSubtotal: minorToInput(coupon.minSubtotalMinor),
      startsAt: toLocalInput(coupon.startsAt),
      expiresAt: toLocalInput(coupon.expiresAt),
      usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
      perUserLimit: String(coupon.perUserLimit),
      isActive: coupon.isActive,
    },
  };
}

/**
 * Create (id = null) or update a coupon. The database enforces every rule, including that a
 * used coupon's code and discount cannot change.
 */
export async function saveCoupon(id, row) {
  const query = id
    ? supabase.from('coupons').update(row).eq('id', id)
    : supabase.from('coupons').insert(row);
  const { data, error } = await query.select('id');
  if (error || !data?.length)
    throw new Error(friendlySaveError(error ?? { code: '42501' }, 'coupon'));
  return data[0].id;
}

/** Pause / resume. Coupons are never deleted. */
export async function setCouponActive(id, isActive) {
  const { data, error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) {
    throw new Error(
      isActive ? 'We could not resume the coupon.' : 'We could not pause the coupon.',
    );
  }
}
