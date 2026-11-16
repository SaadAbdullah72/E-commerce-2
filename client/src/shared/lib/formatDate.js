import { MARKET } from '../constants/market';

/**
 * A date and time for people, in the shop's locale and the viewer's own time zone:
 * "Nov 16, 2026, 3:09 PM". Empty string for a missing or invalid value.
 *
 * @param {string | number | Date | null | undefined} value an ISO string from the database
 * @returns {string}
 */
export function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(MARKET.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

/** Same, date only: "Nov 16, 2026". */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(MARKET.locale, { dateStyle: 'medium' }).format(date);
}
