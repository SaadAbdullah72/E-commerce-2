import { describe, expect, it } from 'vitest';

import { SLUG_PATTERN, slugify } from './slugify';

describe('slugify', () => {
  it('makes a database-valid slug', () => {
    expect(slugify('Wireless Earbuds (2nd Gen)!')).toBe('wireless-earbuds-2nd-gen');
    expect(slugify('  Home & Kitchen  ')).toBe('home-and-kitchen');
    expect(slugify('Café Crème')).toBe('cafe-creme');
    expect(slugify('a---b___c')).toBe('a-b-c');
  });

  it('gives an empty string when nothing usable is left', () => {
    expect(slugify('')).toBe('');
    expect(slugify('!!!')).toBe('');
    expect(slugify(null)).toBe('');
  });

  it('respects the length limit without a trailing hyphen', () => {
    const slug = slugify('word '.repeat(100), 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('always matches the slug pattern when not empty', () => {
    for (const title of ['A', 'Hello World', 'x  y  z', '100% Cotton T-Shirt']) {
      expect(slugify(title)).toMatch(SLUG_PATTERN);
    }
  });
});
