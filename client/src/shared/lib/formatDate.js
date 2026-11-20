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

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened, for lists: "2 hours ago", "yesterday". After a week it is
 * the plain date. Put the full date and time in a `title` next to it for people who want it.
 *
 * @param {string | number | Date | null | undefined} value
 * @param {Date} [now] only tests pass this
 * @returns {string}
 */
export function formatRelative(value, now = new Date()) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.trunc((date.getTime() - now.getTime()) / 1000);
  const age = Math.abs(seconds);
  if (age >= 7 * DAY) return formatDate(date);

  const rtf = new Intl.RelativeTimeFormat(MARKET.locale, { numeric: 'auto' });
  if (age < MINUTE) return rtf.format(0, 'second');
  if (age < HOUR) return rtf.format(Math.trunc(seconds / MINUTE), 'minute');
  if (age < DAY) return rtf.format(Math.trunc(seconds / HOUR), 'hour');
  return rtf.format(Math.trunc(seconds / DAY), 'day');
}
