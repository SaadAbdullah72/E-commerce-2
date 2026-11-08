import { MARKET } from '../constants/market';

const formatters = new Map();

function getFormatter(currency) {
  if (!formatters.has(currency)) {
    formatters.set(currency, new Intl.NumberFormat(MARKET.locale, { style: 'currency', currency }));
  }
  return formatters.get(currency);
}

/**
 * Format a price stored in minor units (cents) for display.
 * formatMoney(1299) -> "$12.99" (with the market currency from market.js)
 *
 * @param {number | null | undefined} minorUnits
 * @param {string} [currency] defaults to the market currency
 * @returns {string} empty string for a missing or invalid amount
 */
export function formatMoney(minorUnits, currency = MARKET.currency) {
  if (typeof minorUnits !== 'number' || !Number.isFinite(minorUnits)) return '';
  try {
    return getFormatter(currency).format(minorUnits / MARKET.minorUnitsPerMajor);
  } catch {
    return '';
  }
}
