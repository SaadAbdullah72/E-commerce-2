import { formatMoney } from '@/shared/lib/formatMoney';

/** A failed checkout step, carrying the short code the server sent. */
export class CheckoutError extends Error {
  /**
   * @param {string} code e.g. "insufficient_stock", "coupon_expired"
   * @param {string} [message] technical text; never shown to the customer
   * @param {string | null} [productId] set for stock / availability problems
   */
  constructor(code, message = code, productId = null) {
    super(message);
    this.name = 'CheckoutError';
    this.code = code;
    this.productId = productId;
  }
}

/** Problems that mean "go and look at your cart again". */
const CART_PROBLEMS = new Set(['insufficient_stock', 'product_unavailable', 'invalid_cart']);
export const isCartProblem = (code) => CART_PROBLEMS.has(code);

export const isCouponProblem = (code) => typeof code === 'string' && code.startsWith('coupon_');

/**
 * Text for a coupon refusal. `reason` is what the database returns: not_found, not_started,
 * expired, used_up, already_used or min_subtotal.
 *
 * @param {string} reason
 * @param {{ minSubtotalMinor?: number, currency?: string }} [details]
 */
export function couponMessage(reason, { minSubtotalMinor, currency } = {}) {
  switch (reason) {
    case 'not_started':
      return 'That coupon is not active yet.';
    case 'expired':
      return 'That coupon has expired.';
    case 'used_up':
      return 'That coupon has been fully used.';
    case 'already_used':
      return 'You have already used that coupon.';
    case 'min_subtotal':
      return Number.isInteger(minSubtotalMinor)
        ? `Spend at least ${formatMoney(minSubtotalMinor, currency)} to use this coupon.`
        : 'Your order is below the minimum for that coupon.';
    default:
      return 'That coupon code is not valid.';
  }
}

/**
 * Friendly text for any checkout failure. Raw server or database text is never shown.
 *
 * @param {{ code?: string, productId?: string | null } | null | undefined} error
 * @param {{ titleFor?: (productId: string) => string | undefined }} [options]
 *   lets the message name the product that caused the problem
 */
export function checkoutErrorMessage(error, { titleFor } = {}) {
  const code = error?.code;
  const title = error?.productId ? titleFor?.(error.productId) : undefined;

  if (isCouponProblem(code)) return couponMessage(code.slice('coupon_'.length));

  switch (code) {
    case 'insufficient_stock':
      return title
        ? `There is not enough stock left for "${title}". Please review your cart.`
        : 'There is not enough stock left for an item in your cart. Please review your cart.';
    case 'product_unavailable':
      return title
        ? `"${title}" is no longer available. Please review your cart.`
        : 'An item in your cart is no longer available. Please review your cart.';
    case 'invalid_cart':
      return 'Your cart is not valid. Please review it and try again.';
    case 'invalid_shipping':
      return 'Please check your shipping details and try again.';
    case 'mixed_currency':
      return 'Your cart mixes currencies. Please check out the items separately.';
    case 'too_many_pending':
      return 'You already have unpaid orders open. Finish or cancel one first, or wait a few minutes.';
    case 'amount_too_small':
      return 'This order is too small to pay online. Add another item and try again.';
    case 'not_signed_in':
      return 'Please sign in again to check out.';
    case 'rate_limited':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'payment_unavailable':
      return "We couldn't start the payment. Please try again.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
