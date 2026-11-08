import { MAX_QTY_PER_ITEM } from '../constants';
import { lineKey } from './lineKey';

/**
 * @typedef {{ productId: string, size: string | null, color: string | null, quantity: number,
 *   selected: boolean, priceSeenMinor: number | null }} CartItem  what is stored in the browser
 *
 * @typedef {'loading' | 'error' | 'ok' | 'unavailable' | 'out_of_stock'} LineStatus
 */

/**
 * Most units allowed for a product with this much stock.
 * @param {number | null | undefined} stock
 */
export function maxQuantityFor(stock) {
  const available = Number.isFinite(stock) ? Math.floor(stock) : MAX_QTY_PER_ITEM;
  return Math.max(0, Math.min(MAX_QTY_PER_ITEM, available));
}

/**
 * Force a quantity into the allowed range. Returns 0 when nothing can be bought.
 * @param {unknown} quantity
 * @param {number | null | undefined} stock
 */
export function clampQuantity(quantity, stock) {
  const max = maxQuantityFor(stock);
  if (max === 0) return 0;
  const whole = Math.floor(Number(quantity));
  if (!Number.isFinite(whole) || whole < 1) return 1;
  return Math.min(whole, max);
}

/**
 * Whole-cent maths only: unit price and quantity are integers, so no rounding drift.
 * @param {number} unitPriceMinor
 * @param {number} quantity
 */
export function lineTotalMinor(unitPriceMinor, quantity) {
  return unitPriceMinor * quantity;
}

/**
 * Join the stored cart with the live product data from the database. The stored cart never
 * holds a price: every price shown or added up here comes from `productsById`.
 *
 * @param {CartItem[]} items
 * @param {Map<string, any>} productsById
 * @param {'loading' | 'ready' | 'error'} productsState
 */
export function buildLines(items, productsById, productsState) {
  return items.map((item) => {
    const key = lineKey(item.productId, item.size, item.color);
    const product = productsById.get(item.productId);
    const variant = [item.color, item.size].filter(Boolean).join(' / ');

    const base = {
      key,
      _id: item.productId, // older components key on _id
      productId: item.productId,
      size: item.size,
      color: item.color,
      variant,
      selected: item.selected,
      requestedQuantity: item.quantity,
    };

    if (!product) {
      /** @type {LineStatus} */
      const status =
        productsState === 'ready' ? 'unavailable' : productsState === 'error' ? 'error' : 'loading';
      return { ...base, status, quantity: item.quantity, unitPriceMinor: 0, lineTotalMinor: 0 };
    }

    const maxQuantity = maxQuantityFor(product.stock);
    const status = maxQuantity === 0 ? 'out_of_stock' : 'ok';
    const quantity = status === 'ok' ? Math.min(item.quantity, maxQuantity) : item.quantity;
    const priceChanged = item.priceSeenMinor !== null && item.priceSeenMinor !== product.priceMinor;

    return {
      ...base,
      status,
      quantity,
      maxQuantity,
      quantityReduced: status === 'ok' && quantity < item.quantity,
      slug: product.slug,
      title: product.title,
      images: product.images,
      image: product.images[0] ?? null,
      currency: product.currency,
      unitPriceMinor: product.priceMinor,
      lineTotalMinor: status === 'ok' ? lineTotalMinor(product.priceMinor, quantity) : 0,
      priceChanged,
      previousPriceMinor: priceChanged ? item.priceSeenMinor : null,
    };
  });
}

/** Lines the customer ticked AND can actually buy right now. */
export function purchasableSelected(lines) {
  return lines.filter((line) => line.selected && line.status === 'ok');
}

/** Sum of line totals, in whole cents. */
export function subtotalMinor(lines) {
  return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

/** Total units across lines. */
export function countUnits(lines) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
