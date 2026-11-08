import { describe, expect, it } from 'vitest';

import { ADMIN_SECTIONS, LOW_STOCK_THRESHOLD, stockStatus } from './adminStats';

describe('stockStatus', () => {
  it('is out at 0 or below, low up to the threshold, ok above it', () => {
    expect(stockStatus(0)).toBe('out');
    expect(stockStatus(-3)).toBe('out');
    expect(stockStatus(1)).toBe('low');
    expect(stockStatus(LOW_STOCK_THRESHOLD)).toBe('low');
    expect(stockStatus(LOW_STOCK_THRESHOLD + 1)).toBe('ok');
  });

  it('treats a missing stock figure as out of stock', () => {
    expect(stockStatus(null)).toBe('out');
    expect(stockStatus(undefined)).toBe('out');
  });

  it('uses a threshold of 5', () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
  });
});

describe('ADMIN_SECTIONS', () => {
  it('gives every unfinished section a phase label', () => {
    for (const section of ADMIN_SECTIONS.filter((item) => !item.ready)) {
      expect(section.phase).toMatch(/^Phase \d$/);
    }
  });
});
