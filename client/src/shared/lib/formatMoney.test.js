import { describe, expect, it } from 'vitest';

import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('formats whole minor units as the market currency (USD for now)', () => {
    expect(formatMoney(1299)).toBe('$12.99');
    expect(formatMoney(50)).toBe('$0.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(100000)).toBe('$1,000.00');
  });

  it('avoids floating point drift', () => {
    expect(formatMoney(1950)).toBe('$19.50');
    expect(formatMoney(1999)).toBe('$19.99');
  });

  it('returns an empty string for missing or invalid amounts', () => {
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(Number.NaN)).toBe('');
    expect(formatMoney('1299')).toBe('');
  });

  it('accepts an explicit currency and survives a bad currency code', () => {
    expect(formatMoney(1299, 'PKR')).toContain('PKR');
    expect(formatMoney(1299, 'not-a-currency')).toBe('');
  });
});
