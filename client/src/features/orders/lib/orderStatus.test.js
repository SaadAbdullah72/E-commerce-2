import { describe, expect, it } from 'vitest';

import { buildTimeline, canCancel, cancelReasonText, isPast, statusInfo } from './orderStatus';

describe('statusInfo', () => {
  it('uses plain words, with "Awaiting payment" for an unpaid order', () => {
    expect(statusInfo('pending_payment').label).toBe('Awaiting payment');
    expect(statusInfo('paid').label).toBe('Paid');
    expect(statusInfo('shipped').label).toBe('Shipped');
    expect(statusInfo('delivered').label).toBe('Delivered');
    expect(statusInfo('cancelled').label).toBe('Cancelled');
  });

  it('never shows a raw value for an unknown status', () => {
    expect(statusInfo('mystery').label).toBe('Unknown');
  });
});

describe('canCancel', () => {
  it('is only true for an unpaid order', () => {
    expect(canCancel('pending_payment')).toBe(true);
    for (const status of ['paid', 'shipped', 'delivered', 'cancelled']) {
      expect(canCancel(status)).toBe(false);
    }
  });
});

describe('cancelReasonText', () => {
  it('explains each reason in plain words', () => {
    expect(cancelReasonText('customer')).toBe('You cancelled this order.');
    expect(cancelReasonText('expired')).toMatch(/not completed in time/);
    expect(cancelReasonText('payment_failed')).toMatch(/did not go through/);
    expect(cancelReasonText('error')).toMatch(/could not process/);
  });

  it('says nothing for a missing or unknown reason', () => {
    expect(cancelReasonText(null)).toBe('');
    expect(cancelReasonText('whatever')).toBe('');
  });
});

describe('buildTimeline', () => {
  const base = {
    createdAt: '2030-01-01T00:00:00Z',
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
  };
  const done = (order) => buildTimeline(order).map((step) => `${step.key}:${step.done}`);

  it('an unpaid order has only "placed" done', () => {
    expect(done({ ...base, status: 'pending_payment' })).toEqual([
      'placed:true',
      'paid:false',
      'shipped:false',
      'delivered:false',
    ]);
  });

  it('a paid order is done up to paid and carries the paid date', () => {
    const steps = buildTimeline({ ...base, status: 'paid', paidAt: '2030-01-01T00:05:00Z' });
    expect(steps.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(steps[1].at).toBe('2030-01-01T00:05:00Z');
  });

  it('shipped and delivered orders are done up to their step, even before R7 fills the dates', () => {
    expect(done({ ...base, status: 'shipped' })).toEqual([
      'placed:true',
      'paid:true',
      'shipped:true',
      'delivered:false',
    ]);
    expect(done({ ...base, status: 'delivered' })).toEqual([
      'placed:true',
      'paid:true',
      'shipped:true',
      'delivered:true',
    ]);
  });

  it('a cancelled order shows only what happened: placed, then cancelled', () => {
    const steps = buildTimeline({
      ...base,
      status: 'cancelled',
      cancelledAt: '2030-01-02T00:00:00Z',
    });
    expect(steps.map((s) => s.key)).toEqual(['placed', 'cancelled']);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(steps[1].at).toBe('2030-01-02T00:00:00Z');
  });
});

describe('isPast', () => {
  it('compares an ISO date with now', () => {
    expect(isPast('2000-01-01T00:00:00Z')).toBe(true);
    expect(isPast('2999-01-01T00:00:00Z')).toBe(false);
    expect(isPast('garbage')).toBe(false);
    expect(isPast(null)).toBe(false);
  });
});
