import { beforeEach, describe, expect, it } from 'vitest';

import {
  CheckoutError,
  checkoutErrorMessage,
  couponMessage,
  isCartProblem,
  isCouponProblem,
} from './checkoutErrors';
import { estimateDeliveryFeeMinor, FREE_DELIVERY_STATE } from './delivery';
import { clearShipping, loadShipping, saveShipping } from './shippingStorage';

describe('checkoutErrorMessage', () => {
  const titleFor = (id) => (id === 'p1' ? 'Desk lamp' : undefined);

  it('names the product when it knows it', () => {
    expect(
      checkoutErrorMessage({ code: 'insufficient_stock', productId: 'p1' }, { titleFor }),
    ).toBe('There is not enough stock left for "Desk lamp". Please review your cart.');
    expect(
      checkoutErrorMessage({ code: 'product_unavailable', productId: 'p1' }, { titleFor }),
    ).toBe('"Desk lamp" is no longer available. Please review your cart.');
  });

  it('still reads well when the product is unknown', () => {
    expect(
      checkoutErrorMessage({ code: 'insufficient_stock', productId: 'zzz' }, { titleFor }),
    ).toBe('There is not enough stock left for an item in your cart. Please review your cart.');
    expect(checkoutErrorMessage({ code: 'product_unavailable' })).toMatch(/no longer available/);
  });

  it.each([
    ['invalid_cart', /cart is not valid/],
    ['invalid_shipping', /shipping details/],
    ['mixed_currency', /mixes currencies/],
    ['too_many_pending', /unpaid orders open/],
    ['amount_too_small', /too small to pay online/],
    ['not_signed_in', /sign in again/],
    ['rate_limited', /Too many attempts/],
    ['payment_unavailable', /couldn't start the payment/],
  ])('maps %s to friendly text', (code, pattern) => {
    expect(checkoutErrorMessage({ code })).toMatch(pattern);
  });

  it('maps every coupon_* code through the coupon texts', () => {
    expect(checkoutErrorMessage({ code: 'coupon_expired' })).toBe('That coupon has expired.');
    expect(checkoutErrorMessage({ code: 'coupon_already_used' })).toBe(
      'You have already used that coupon.',
    );
    expect(checkoutErrorMessage({ code: 'coupon_not_found' })).toBe(
      'That coupon code is not valid.',
    );
  });

  it('never shows raw server text for an unknown failure', () => {
    const error = new CheckoutError('weird_code', 'secret database internals');
    const text = checkoutErrorMessage(error);
    expect(text).toBe('Something went wrong. Please try again.');
    expect(text).not.toMatch(/secret/);
    expect(checkoutErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});

describe('couponMessage', () => {
  it('explains each reason', () => {
    expect(couponMessage('not_found')).toBe('That coupon code is not valid.');
    expect(couponMessage('not_started')).toBe('That coupon is not active yet.');
    expect(couponMessage('expired')).toBe('That coupon has expired.');
    expect(couponMessage('used_up')).toBe('That coupon has been fully used.');
    expect(couponMessage('already_used')).toBe('You have already used that coupon.');
  });

  it('states the minimum spend in money, and falls back when it is unknown', () => {
    expect(couponMessage('min_subtotal', { minSubtotalMinor: 2500, currency: 'USD' })).toBe(
      'Spend at least $25.00 to use this coupon.',
    );
    expect(couponMessage('min_subtotal')).toBe('Your order is below the minimum for that coupon.');
  });

  it('treats anything unknown as an invalid code', () => {
    expect(couponMessage('???')).toBe('That coupon code is not valid.');
  });
});

describe('problem classifiers', () => {
  it('knows which codes mean "look at your cart" and which are coupon problems', () => {
    expect(isCartProblem('insufficient_stock')).toBe(true);
    expect(isCartProblem('product_unavailable')).toBe(true);
    expect(isCartProblem('invalid_cart')).toBe(true);
    expect(isCartProblem('coupon_expired')).toBe(false);
    expect(isCouponProblem('coupon_expired')).toBe(true);
    expect(isCouponProblem('invalid_cart')).toBe(false);
    expect(isCouponProblem(undefined)).toBe(false);
  });
});

describe('estimateDeliveryFeeMinor', () => {
  it('is free in the local hub and the placeholder fee elsewhere', () => {
    expect(estimateDeliveryFeeMinor(FREE_DELIVERY_STATE)).toBe(0);
    expect(estimateDeliveryFeeMinor('Lagos State')).toBe(480);
    expect(estimateDeliveryFeeMinor('')).toBe(480);
  });
});

describe('shippingStorage', () => {
  const details = {
    fullName: 'Sam Lee',
    email: 'sam@example.com',
    phone: '+10000000000',
    address: '1 Test Street',
    state: 'Lagos State',
    city: 'City Central / Metropolis',
    courier: 'Shipbubble',
    notes: '',
    deliveryFeeMinor: 480, // not a stored field
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps details in this tab only (sessionStorage), never localStorage', () => {
    saveShipping(details, 'u1');
    expect(sessionStorage.getItem('shopyaro_shipping')).not.toBeNull();
    expect(localStorage.getItem('shopyaro_shipping')).toBeNull();
    expect(loadShipping('u1')).toEqual({
      fullName: 'Sam Lee',
      email: 'sam@example.com',
      phone: '+10000000000',
      address: '1 Test Street',
      state: 'Lagos State',
      city: 'City Central / Metropolis',
      courier: 'Shipbubble',
      notes: '',
    });
  });

  it('never hands one account details to another account', () => {
    saveShipping(details, 'u1');
    expect(loadShipping('u2')).toBeNull();
    expect(loadShipping(undefined)).toBeNull();
  });

  it('deletes the old plain localStorage copy', () => {
    localStorage.setItem('shopyaro_shipping', '{"address":"old"}');
    loadShipping('u1');
    expect(localStorage.getItem('shopyaro_shipping')).toBeNull();
  });

  it('treats incomplete or damaged data as nothing', () => {
    saveShipping({ ...details, address: '' }, 'u1');
    expect(loadShipping('u1')).toBeNull();
    sessionStorage.setItem('shopyaro_shipping', 'not json');
    expect(loadShipping('u1')).toBeNull();
  });

  it('clears everything', () => {
    saveShipping(details, 'u1');
    localStorage.setItem('shopyaro_shipping', 'x');
    clearShipping();
    expect(loadShipping('u1')).toBeNull();
    expect(localStorage.getItem('shopyaro_shipping')).toBeNull();
  });
});
