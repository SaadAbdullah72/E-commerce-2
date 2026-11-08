import { MARKET } from '@/shared/constants/market';

/** The database allows up to 100,000,000 minor units (see products_price_minor_check). */
export const MAX_PRICE_MINOR = 100_000_000;

const DECIMAL_PLACES = Math.round(Math.log10(MARKET.minorUnitsPerMajor));
const AMOUNT_PATTERN = new RegExp(`^\\d{1,9}(\\.\\d{1,${DECIMAL_PLACES}})?$`);

/**
 * "12.99" -> 1299. Text only, no floating-point maths, so there is never a rounding error.
 * Returns null for anything that is not a plain non-negative amount within the limit.
 *
 * @param {string | null | undefined} text
 * @returns {number | null}
 */
export function parseMoneyToMinor(text) {
  const value = String(text ?? '').trim();
  if (!AMOUNT_PATTERN.test(value)) return null;

  const [whole, fraction = ''] = value.split('.');
  const minor =
    Number(whole) * MARKET.minorUnitsPerMajor + Number(fraction.padEnd(DECIMAL_PLACES, '0') || 0);
  return minor <= MAX_PRICE_MINOR ? minor : null;
}

/**
 * 1299 -> "12.99", for filling a form field.
 * @param {number | null | undefined} minor
 */
export function minorToInput(minor) {
  if (!Number.isInteger(minor)) return '';
  const whole = Math.floor(minor / MARKET.minorUnitsPerMajor);
  const fraction = String(minor % MARKET.minorUnitsPerMajor).padStart(DECIMAL_PLACES, '0');
  return `${whole}.${fraction}`;
}
