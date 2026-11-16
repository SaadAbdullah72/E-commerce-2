/**
 * How an order's status is shown to the customer.
 * Statuses come from the database: pending_payment | paid | shipped | delivered | cancelled.
 */

const STATUSES = {
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  paid: { label: 'Paid', tone: 'blue' },
  shipped: { label: 'Shipped', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export const TONE_CLASSES = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

/** @param {string} status */
export function statusInfo(status) {
  return STATUSES[status] ?? { label: 'Unknown', tone: 'gray' };
}

/** Only an unpaid order can be cancelled by its customer. */
export const canCancel = (status) => status === 'pending_payment';

const CANCEL_REASONS = {
  customer: 'You cancelled this order.',
  expired: 'The payment was not completed in time.',
  payment_failed: 'The payment did not go through.',
  error: 'We could not process this order.',
};

/**
 * @param {string | null | undefined} reason cancel_reason from the database
 * @returns {string} plain wording, or '' when there is none
 */
export function cancelReasonText(reason) {
  return CANCEL_REASONS[reason] ?? '';
}

/**
 * The steps shown in the status timeline, in order. Each step is done when its date is known.
 * A cancelled order shows only what really happened: placed, then cancelled.
 *
 * @param {{ status: string, createdAt: string | null, paidAt: string | null,
 *   shippedAt: string | null, deliveredAt: string | null, cancelledAt: string | null }} order
 * @returns {{ key: string, label: string, at: string | null, done: boolean }[]}
 */
export function buildTimeline(order) {
  if (order.status === 'cancelled') {
    return [
      { key: 'placed', label: 'Order placed', at: order.createdAt, done: true },
      { key: 'cancelled', label: 'Cancelled', at: order.cancelledAt, done: true },
    ];
  }
  const steps = [
    { key: 'placed', label: 'Order placed', at: order.createdAt },
    { key: 'paid', label: 'Paid', at: order.paidAt },
    { key: 'shipped', label: 'Shipped', at: order.shippedAt },
    { key: 'delivered', label: 'Delivered', at: order.deliveredAt },
  ];
  // The status decides how far the order got; a date is shown when the database has one.
  const reached = { pending_payment: 0, paid: 1, shipped: 2, delivered: 3 }[order.status] ?? 0;
  return steps.map((step, index) => ({ ...step, done: index <= reached || Boolean(step.at) }));
}

/** True when the given ISO date has already passed. */
export function isPast(iso) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time < Date.now();
}
