/**
 * Open-redirect protection. Any "go here after auth" value that comes from a URL
 * must pass through getSafeRedirect() before it reaches navigate().
 *
 * Only exact paths from the allow-list are accepted, plus one strict pattern: a single order's
 * page, /orders/<uuid>. No query strings, hashes, full URLs, protocol-relative URLs or relative
 * traversal.
 */

export const REDIRECT_ALLOW_LIST = [
  '/',
  '/profile',
  '/orders',
  '/shipping',
  '/checkout',
  '/order/success',
  '/order/cancelled',
  '/admin',
];

const ORDER_PAGE =
  /^\/orders\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value Raw value from a query string such as ?redirect=shipping
 * @param {string} [fallback]
 * @returns {string} an allow-listed internal path
 */
export function getSafeRedirect(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  // Legacy links in this app pass "shipping" without the leading slash.
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  return REDIRECT_ALLOW_LIST.includes(path) || ORDER_PAGE.test(path) ? path : fallback;
}
