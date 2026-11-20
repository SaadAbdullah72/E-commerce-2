import { MARKET } from '@/shared/constants/market';

/**
 * Presentation maths for charts only. No data is read or changed here.
 */

/**
 * "Nice" axis ticks: a top value and evenly spaced ticks from 0 (1, 2, 2.5 or 5 times a power
 * of ten), so the labels read 0, 25, 50, 75, 100 and not 0, 23, 46...
 *
 * @param {number} max the biggest value in the data
 * @param {{ integer?: boolean, ticks?: number }} [options] `integer` for counts (whole steps only)
 * @returns {{ top: number, ticks: number[] }}
 */
export function niceScale(max, { integer = false, ticks = 4 } = {}) {
  const biggest = Math.max(Number(max) || 0, 1);
  const raw = biggest / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((size) => size >= raw);
  if (integer) step = Math.max(1, Math.ceil(step));

  const count = Math.ceil(biggest / step);
  const values = [];
  for (let index = 0; index <= count; index += 1) values.push(index * step);
  return { top: count * step, ticks: values };
}

/**
 * A short money label for an axis: "$250", "$1K", "$2.5K". Takes minor units (cents).
 *
 * @param {number} minorUnits
 * @param {string} [currency]
 */
export function compactMoney(minorUnits, currency = MARKET.currency) {
  if (typeof minorUnits !== 'number' || !Number.isFinite(minorUnits)) return '';
  try {
    return new Intl.NumberFormat(MARKET.locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(minorUnits / MARKET.minorUnitsPerMajor);
  } catch {
    return '';
  }
}

/** "Jan 14" from "2030-01-14" (a UTC day). */
export const shortDay = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * How the last 7 FULL days compare with the 7 full days before them, from the per-day series.
 * Today is left out on purpose: it is not finished, and a part-day set against full days would
 * always look like a drop. Both weeks are whole UTC days, so they are comparable. (The big
 * number on the card is a rolling 7 x 24 hours, so the two can differ a little.)
 * Null when there is nothing to compare (fewer than 15 days, or no sales in either week).
 *
 * @param {{ day: string, count: number }[]} points oldest first; the last one is today
 * @returns {{ direction: 'up' | 'down' | 'flat', text: string, note: string } | null}
 */
export function sevenDayTrend(points) {
  if (points.length < 15) return null;
  const complete = points.slice(0, -1);
  const sum = (slice) => slice.reduce((total, point) => total + point.count, 0);
  const current = sum(complete.slice(-7));
  const previous = sum(complete.slice(-14, -7));
  if (current === 0 && previous === 0) return null;

  const note = 'Full UTC days, today not counted';
  if (previous === 0) return { direction: 'up', text: 'Up from no sales in the 7 days before', note };

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { direction: 'flat', text: 'No change vs the 7 days before', note };
  return change > 0
    ? { direction: 'up', text: `Up ${change}% vs the 7 days before`, note }
    : { direction: 'down', text: `Down ${Math.abs(change)}% vs the 7 days before`, note };
}
