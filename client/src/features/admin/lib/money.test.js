import { describe, expect, it } from 'vitest';

import { MAX_PRICE_MINOR, minorToInput, parseMoneyToMinor } from './money';

describe('parseMoneyToMinor', () => {
  it('turns text into whole cents without rounding errors', () => {
    expect(parseMoneyToMinor('12.99')).toBe(1299);
    expect(parseMoneyToMinor('12.9')).toBe(1290);
    expect(parseMoneyToMinor('12')).toBe(1200);
    expect(parseMoneyToMinor('0.07')).toBe(7);
    expect(parseMoneyToMinor('19.99')).toBe(1999);
    expect(parseMoneyToMinor(' 5.50 ')).toBe(550);
    expect(parseMoneyToMinor('0')).toBe(0);
  });

  it('rejects anything that is not a plain amount', () => {
    for (const bad of [
      '',
      ' ',
      '-1',
      '1.234',
      '1,50',
      '$5',
      '1e3',
      'abc',
      '.5',
      '5.',
      null,
      undefined,
    ]) {
      expect(parseMoneyToMinor(bad)).toBeNull();
    }
  });

  it('rejects amounts above the database limit', () => {
    expect(parseMoneyToMinor('1000000.00')).toBe(MAX_PRICE_MINOR);
    expect(parseMoneyToMinor('1000000.01')).toBeNull();
    expect(parseMoneyToMinor('99999999999')).toBeNull();
  });
});

describe('minorToInput', () => {
  it('formats cents for a form field', () => {
    expect(minorToInput(1299)).toBe('12.99');
    expect(minorToInput(1200)).toBe('12.00');
    expect(minorToInput(7)).toBe('0.07');
    expect(minorToInput(0)).toBe('0.00');
  });

  it('is empty for a missing value', () => {
    expect(minorToInput(null)).toBe('');
    expect(minorToInput(undefined)).toBe('');
    expect(minorToInput(1.5)).toBe('');
  });

  it('round-trips', () => {
    for (const minor of [0, 1, 99, 100, 1299, 99999999]) {
      expect(parseMoneyToMinor(minorToInput(minor))).toBe(minor);
    }
  });
});
