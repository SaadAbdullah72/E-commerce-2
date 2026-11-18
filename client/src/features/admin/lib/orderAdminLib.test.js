import { describe, expect, it } from 'vitest';

import {
  cancelReasonText,
  canEditTracking,
  MAX_TRACKING,
  nextStep,
  orderStatusInfo,
  paymentIssueText,
  validateTracking,
} from './orderFlow';
import { fillDailyRevenue, paidOrderCount, parseOrderStats, primaryCurrency } from './orderStats';

const NOW = new Date('2030-01-30T12:00:00Z');

const RAW = () => ({
  by_status: { pending_payment: 1, paid: 2, shipped: 3, delivered: 4, cancelled: 5 },
  to_ship: 2,
  needs_refund: 1,
  revenue: [
    {
      currency: 'USD',
      orders: 9,
      all_time_minor: 90000,
      last_24h_minor: 1000,
      last_7d_minor: 5000,
      last_30d_minor: 20000,
      average_order_minor: 10000,
    },
  ],
  daily: [{ day: '2030-01-29', currency: 'USD', orders: 2, revenue_minor: 3000 }],
  top_products: [
    { product_id: 'p1', title: 'Earbuds', currency: 'USD', units: 7, revenue_minor: 70000 },
  ],
});

describe('parseOrderStats', () => {
  it('reshapes a good answer and notes which day today is (UTC)', () => {
    const stats = parseOrderStats(RAW(), NOW);
    expect(stats.today).toBe('2030-01-30');
    expect(stats.toShip).toBe(2);
    expect(stats.needsRefund).toBe(1);
    expect(stats.byStatus).toEqual({
      pending_payment: 1,
      paid: 2,
      shipped: 3,
      delivered: 4,
      cancelled: 5,
    });
    expect(stats.revenue[0]).toMatchObject({ currency: 'USD', allTimeMinor: 90000, orders: 9 });
    expect(stats.daily[0]).toEqual({
      day: '2030-01-29',
      currency: 'USD',
      orders: 2,
      revenueMinor: 3000,
    });
    expect(stats.topProducts[0]).toMatchObject({ productId: 'p1', units: 7 });
  });

  it('accepts an empty shop (no revenue rows is real, not an error)', () => {
    const raw = { ...RAW(), revenue: [], daily: [], top_products: [] };
    expect(parseOrderStats(raw, NOW).revenue).toEqual([]);
  });

  it.each([
    ['nothing at all', null],
    ['a string', 'oops'],
    ['no by_status', { ...RAW(), by_status: undefined }],
    [
      'a missing status count',
      (() => {
        const r = RAW();
        delete r.by_status.paid;
        return r;
      })(),
    ],
    ['a null to_ship', { ...RAW(), to_ship: null }],
    ['a missing needs_refund', { ...RAW(), needs_refund: undefined }],
    ['a negative count', { ...RAW(), to_ship: -1 }],
    ['text instead of a number', { ...RAW(), needs_refund: 'many' }],
    ['revenue that is not a list', { ...RAW(), revenue: null }],
    [
      'a revenue row with a missing amount',
      (() => {
        const r = RAW();
        delete r.revenue[0].all_time_minor;
        return r;
      })(),
    ],
    [
      'a revenue row without a currency',
      (() => {
        const r = RAW();
        r.revenue[0].currency = '';
        return r;
      })(),
    ],
    [
      'a daily row with a bad day',
      (() => {
        const r = RAW();
        r.daily[0].day = 'yesterday';
        return r;
      })(),
    ],
    ['daily that is not a list', { ...RAW(), daily: {} }],
    ['top_products that is missing', { ...RAW(), top_products: undefined }],
  ])('throws for %s instead of inventing zeros', (_name, raw) => {
    expect(() => parseOrderStats(raw, NOW)).toThrow();
  });
});

describe('paidOrderCount and primaryCurrency', () => {
  it('counts paid, shipped and delivered only', () => {
    expect(
      paidOrderCount({ pending_payment: 9, paid: 1, shipped: 2, delivered: 3, cancelled: 9 }),
    ).toBe(6);
  });

  it('picks the currency with the most orders, or null when there are none', () => {
    expect(primaryCurrency([])).toBeNull();
    expect(
      primaryCurrency([
        { currency: 'EUR', orders: 2 },
        { currency: 'USD', orders: 5 },
      ]),
    ).toBe('USD');
  });
});

describe('fillDailyRevenue', () => {
  it('returns 30 days ending today, with real zeros on days without sales', () => {
    const points = fillDailyRevenue(
      [
        { day: '2030-01-29', currency: 'USD', revenueMinor: 3000 },
        { day: '2030-01-30', currency: 'USD', revenueMinor: 500 },
        { day: '2030-01-30', currency: 'EUR', revenueMinor: 99999 },
      ],
      'USD',
      '2030-01-30',
    );
    expect(points).toHaveLength(30);
    expect(points[0].day).toBe('2030-01-01');
    expect(points[29]).toEqual({ day: '2030-01-30', count: 500 });
    expect(points[28]).toEqual({ day: '2030-01-29', count: 3000 });
    expect(points[10].count).toBe(0);
  });

  it('crosses a month boundary correctly', () => {
    const points = fillDailyRevenue([], 'USD', '2030-03-02', 4);
    expect(points.map((point) => point.day)).toEqual([
      '2030-02-27',
      '2030-02-28',
      '2030-03-01',
      '2030-03-02',
    ]);
  });
});

describe('nextStep', () => {
  it('offers only the next forward step', () => {
    expect(nextStep('paid')).toEqual({ status: 'shipped', button: 'Mark as shipped' });
    expect(nextStep('shipped')).toEqual({ status: 'delivered', button: 'Mark as delivered' });
  });

  it.each(['pending_payment', 'delivered', 'cancelled', 'processing', undefined])(
    'offers nothing for %s',
    (status) => {
      expect(nextStep(status)).toBeNull();
    },
  );
});

describe('canEditTracking', () => {
  it('is only for paid, shipped and delivered orders', () => {
    expect(['paid', 'shipped', 'delivered'].every(canEditTracking)).toBe(true);
    expect(canEditTracking('pending_payment')).toBe(false);
    expect(canEditTracking('cancelled')).toBe(false);
  });
});

describe('validateTracking', () => {
  it('accepts empty, normal and exactly-100-character values', () => {
    expect(validateTracking('')).toBe('');
    expect(validateTracking('   ')).toBe('');
    expect(validateTracking('TRK-123 456')).toBe('');
    expect(validateTracking('x'.repeat(MAX_TRACKING))).toBe('');
    expect(validateTracking(`  ${'x'.repeat(MAX_TRACKING)}  `)).toBe(''); // trimmed first
  });

  it('refuses more than 100 characters', () => {
    expect(validateTracking('x'.repeat(MAX_TRACKING + 1))).toMatch(/at most 100 characters/);
  });

  it('refuses control characters', () => {
    expect(validateTracking(`ab${String.fromCharCode(7)}cd`)).toMatch(/control characters/);
    expect(validateTracking(`ab${String.fromCharCode(0)}cd`)).toMatch(/control characters/);
    expect(validateTracking(`ab${String.fromCharCode(9)}cd`)).toMatch(/control characters/);
    expect(validateTracking(`ab${String.fromCharCode(127)}cd`)).toMatch(/control characters/);
  });
});

describe('wording', () => {
  it('words the payment problems for the admin', () => {
    expect(paymentIssueText('paid_after_cancel')).toBe(
      'Customer paid after cancellation. Refund manually in Stripe Dashboard.',
    );
    expect(paymentIssueText('amount_mismatch')).toMatch(/did not match/);
    expect(paymentIssueText('something_new')).toBe(
      'Payment issue detected. Admin action required.',
    );
    expect(paymentIssueText(null)).toBe('');
  });

  it('words the cancel reason, or says nothing for an unknown one', () => {
    expect(cancelReasonText('customer')).toBe('reason: cancelled by the customer');
    expect(cancelReasonText('expired')).toBe('reason: payment time ran out');
    expect(cancelReasonText(null)).toBe('');
    expect(cancelReasonText('weird')).toBe('');
  });

  it('labels every status', () => {
    expect(orderStatusInfo('pending_payment').label).toBe('Awaiting payment');
    expect(orderStatusInfo('shipped').label).toBe('Shipped');
    expect(orderStatusInfo('nope').label).toBe('Unknown');
  });
});
