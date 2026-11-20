import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime, formatRelative } from './formatDate';

describe('formatDateTime', () => {
  it('shows date and time for an ISO string from the database', () => {
    const text = formatDateTime('2030-06-15T12:00:00.123456+00:00');
    expect(text).toMatch(/2030/);
    expect(text).toMatch(/Jun/);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });

  it('is empty for a missing or invalid value', () => {
    for (const value of [null, undefined, '', 'not a date']) expect(formatDateTime(value)).toBe('');
  });
});

describe('formatDate', () => {
  it('shows only the date', () => {
    const text = formatDate('2030-06-15T12:00:00+00:00');
    expect(text).toMatch(/Jun 1[456], 2030/); // the viewer's time zone may shift the day
    expect(text).not.toMatch(/:/);
  });

  it('is empty for a missing or invalid value', () => {
    for (const value of [null, undefined, '', 'nope']) expect(formatDate(value)).toBe('');
  });
});

describe('formatRelative', () => {
  const now = new Date('2030-06-15T12:00:00Z');
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();

  it('says "now" for the last minute', () => {
    expect(formatRelative(ago(20_000), now)).toBe('now');
  });

  it('counts minutes, hours and days back', () => {
    expect(formatRelative(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(formatRelative(ago(2 * 3_600_000), now)).toBe('2 hours ago');
    expect(formatRelative(ago(24 * 3_600_000), now)).toBe('yesterday');
    expect(formatRelative(ago(3 * 86_400_000), now)).toBe('3 days ago');
  });

  it('falls back to the plain date after a week', () => {
    expect(formatRelative(ago(10 * 86_400_000), now)).toMatch(/Jun 5, 2030/);
  });

  it('is empty for a missing or invalid value', () => {
    expect(formatRelative(null, now)).toBe('');
    expect(formatRelative('nope', now)).toBe('');
  });
});
