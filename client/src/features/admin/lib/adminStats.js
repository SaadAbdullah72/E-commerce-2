/** A product with this many units or fewer (but more than none) counts as "low stock". */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * @param {number | null | undefined} stock
 * @returns {'out' | 'low' | 'ok'}
 */
export function stockStatus(stock) {
  const units = Number.isFinite(stock) ? stock : 0;
  if (units <= 0) return 'out';
  if (units <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

/** The sidebar and the "coming soon" pages share this list. */
export const ADMIN_SECTIONS = [
  { path: '', label: 'Overview', ready: true },
  { path: 'products', label: 'Products', ready: true },
  { path: 'categories', label: 'Categories', ready: true },
  { path: 'orders', label: 'Orders', ready: false, phase: 'Phase 3' },
  { path: 'coupons', label: 'Coupons', ready: false, phase: 'Phase 4' },
  { path: 'banners', label: 'Banners', ready: false, phase: 'Phase 4' },
  { path: 'logs', label: 'Activity log', ready: false, phase: 'Phase 5' },
];
