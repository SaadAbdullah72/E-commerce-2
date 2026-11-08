import { describe, expect, it } from 'vitest';

import { getSafeRedirect, REDIRECT_ALLOW_LIST } from './safeRedirect';

describe('getSafeRedirect', () => {
  it.each(REDIRECT_ALLOW_LIST)('allows %s', (path) => {
    expect(getSafeRedirect(path)).toBe(path);
  });

  it('adds the leading slash to legacy values such as "shipping"', () => {
    expect(getSafeRedirect('shipping')).toBe('/shipping');
    expect(getSafeRedirect(' checkout ')).toBe('/checkout');
  });

  it.each([
    'https://evil.com',
    'http://evil.com/admin',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/profile/../admin',
    '/profile?next=https://evil.com',
    '/profile#hash',
    '/Admin',
    '/admin/',
    '/not-on-the-list',
    '%2F%2Fevil.com',
    '/%2e%2e/admin',
  ])('rejects %j and falls back', (value) => {
    expect(getSafeRedirect(value)).toBe('/');
  });

  it('falls back for non-strings and empty values', () => {
    expect(getSafeRedirect(undefined)).toBe('/');
    expect(getSafeRedirect(null)).toBe('/');
    expect(getSafeRedirect(42)).toBe('/');
    expect(getSafeRedirect('')).toBe('/');
    expect(getSafeRedirect('   ')).toBe('/');
  });

  it('uses a custom fallback when given', () => {
    expect(getSafeRedirect('https://evil.com', '/login')).toBe('/login');
  });
});
