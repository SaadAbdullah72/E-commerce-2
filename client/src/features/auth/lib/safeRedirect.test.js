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

  describe('a single order page /orders/<uuid>', () => {
    const ID = '11111111-1111-4111-8111-111111111111';

    it('is allowed, with or without the leading slash', () => {
      expect(getSafeRedirect(`/orders/${ID}`)).toBe(`/orders/${ID}`);
      expect(getSafeRedirect(`orders/${ID}`)).toBe(`/orders/${ID}`);
      expect(getSafeRedirect(`/orders/${ID.toUpperCase()}`)).toBe(`/orders/${ID.toUpperCase()}`);
    });

    it.each([
      '/orders/',
      '/orders/123',
      '/orders/not-a-uuid',
      `/orders/${ID}/`,
      `/orders/${ID}?x=1`,
      `/orders/${ID}#top`,
      `/orders/${ID}/edit`,
      `/orders/../admin`,
      `/orders//evil.com`,
      `//orders/${ID}`,
      `/admin/orders/${ID}`,
      `/orders/${ID}%2f..`,
    ])('rejects %j', (value) => {
      expect(getSafeRedirect(value)).toBe('/');
    });
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
