import {
  CART_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEYS,
  MAX_CART_LINES,
  MAX_QTY_PER_ITEM,
} from '../constants';
import { lineKey } from './lineKey';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OPTION_LENGTH = 50;

function cleanOption(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_OPTION_LENGTH ? trimmed : null;
}

/**
 * Keep only well-formed lines. Whatever is in browser storage can be edited by anyone, so
 * everything is re-checked on load: ids must be UUIDs, quantities whole numbers in range,
 * duplicates are merged, and unknown fields (such as a hand-written "price") are dropped.
 *
 * @param {unknown} raw
 * @returns {import('./cartMath').CartItem[]}
 */
export function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];

  const byKey = new Map();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { productId, quantity, selected, priceSeenMinor } = entry;
    if (typeof productId !== 'string' || !UUID_PATTERN.test(productId)) continue;
    if (!Number.isInteger(quantity) || quantity < 1) continue;

    const item = {
      productId,
      size: cleanOption(entry.size),
      color: cleanOption(entry.color),
      quantity: Math.min(quantity, MAX_QTY_PER_ITEM),
      selected: selected !== false,
      priceSeenMinor:
        Number.isInteger(priceSeenMinor) && priceSeenMinor >= 0 ? priceSeenMinor : null,
    };

    const key = lineKey(item.productId, item.size, item.color);
    const existing = byKey.get(key);
    if (existing) existing.quantity = Math.min(existing.quantity + item.quantity, MAX_QTY_PER_ITEM);
    else if (byKey.size < MAX_CART_LINES) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/**
 * Load the cart from the browser. Old-format carts are deleted, not converted.
 * @param {Storage} [storage]
 */
export function loadCart(storage = window.localStorage) {
  try {
    for (const legacyKey of LEGACY_CART_STORAGE_KEYS) storage.removeItem(legacyKey);
    const text = storage.getItem(CART_STORAGE_KEY);
    if (!text) return [];
    const parsed = JSON.parse(text);
    return sanitizeItems(parsed?.version === 2 ? parsed.items : null);
  } catch {
    return [];
  }
}

/**
 * @param {import('./cartMath').CartItem[]} items
 * @param {Storage} [storage]
 */
export function saveCart(items, storage = window.localStorage) {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 2, items }));
  } catch {
    // Storage may be full or blocked; the cart then lives only for this visit.
  }
}
