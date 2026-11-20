import { couponStatus } from '../../lib/couponSchema';

/**
 * Four counts taken from the coupons already on the page (no extra request).
 *
 * @param {{ coupons: object[], now: Date }} props
 */
export default function CouponStats({ coupons, now }) {
  const count = (...states) => coupons.filter((coupon) => states.includes(couponStatus(coupon, now))).length;
  const items = [
    { label: 'Live now', value: count('live'), tone: 'text-green-700' },
    { label: 'Starting later', value: count('scheduled'), tone: 'text-amber-700' },
    { label: 'Paused coupons', value: count('paused'), tone: 'text-gray-900' },
    { label: 'Expired or used up', value: count('expired', 'used-up'), tone: 'text-gray-900' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium text-gray-600">{item.label}</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${item.tone}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
