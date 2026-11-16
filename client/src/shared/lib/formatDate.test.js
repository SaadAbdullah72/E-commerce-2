import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime } from './formatDate';

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
