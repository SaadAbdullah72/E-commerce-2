/**
 * What an admin can do with an order, and how its state is worded for them.
 * The database enforces all of this; these helpers only decide what to offer and explain.
 */

export const MAX_TRACKING = 100;

export const ORDER_STATUS_OPTIONS = [
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_TONES = {
  pending_payment: 'amber',
  paid: 'blue',
  shipped: 'indigo',
  delivered: 'green',
  cancelled: 'gray',
};

/** @param {string} status */
export function orderStatusInfo(status) {
  const option = ORDER_STATUS_OPTIONS.find((item) => item.value === status);
  return { label: option?.label ?? 'Unknown', tone: STATUS_TONES[status] ?? 'gray' };
}

/**
 * The one move the admin can make next (orders only go forward), or null.
 * @param {string} status
 * @returns {{ status: 'shipped' | 'delivered', button: string } | null}
 */
export function nextStep(status) {
  if (status === 'paid') return { status: 'shipped', button: 'Mark as shipped' };
  if (status === 'shipped') return { status: 'delivered', button: 'Mark as delivered' };
  return null;
}

/** A tracking number can be set once the order is paid. */
export const canEditTracking = (status) => ['paid', 'shipped', 'delivered'].includes(status);

/**
 * Same rules as the database: at most 100 characters, no control characters. Empty is fine
 * (it means "no tracking number").
 *
 * @param {string} value
 * @returns {string} an error message, or '' when the value is acceptable
 */
export function validateTracking(value) {
  const tracking = String(value ?? '').trim();
  if (tracking.length > MAX_TRACKING) {
    return `The tracking number can be at most ${MAX_TRACKING} characters.`;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(tracking)) {
    return 'The tracking number cannot contain special control characters.';
  }
  return '';
}

const PAYMENT_ISSUES = {
  paid_after_cancel: 'Customer paid after cancellation. Refund manually in Stripe Dashboard.',
  amount_mismatch:
    "The amount paid did not match this order's total. Check the payment and refund manually in Stripe Dashboard if needed.",
};

export const PAYMENT_ISSUE_TOOLTIP = 'Payment issue detected. Admin action required.';

/** @param {string | null | undefined} issue payment_issue from the database */
export function paymentIssueText(issue) {
  return issue ? (PAYMENT_ISSUES[issue] ?? PAYMENT_ISSUE_TOOLTIP) : '';
}

const CANCEL_REASONS = {
  customer: 'cancelled by the customer',
  expired: 'payment time ran out',
  payment_failed: 'payment failed',
  error: 'could not be processed',
};

/** "reason: payment time ran out", or '' when there is no known reason */
export function cancelReasonText(reason) {
  return CANCEL_REASONS[reason] ? `reason: ${CANCEL_REASONS[reason]}` : '';
}
