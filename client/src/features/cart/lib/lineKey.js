/**
 * Identity of one cart line: the same product in a different size or colour is a
 * different line.
 *
 * @param {string} productId
 * @param {string | null | undefined} size
 * @param {string | null | undefined} color
 */
export function lineKey(productId, size, color) {
  return `${productId}|${size ?? ''}|${color ?? ''}`;
}
