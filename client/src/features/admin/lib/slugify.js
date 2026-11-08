/**
 * "Wireless Earbuds (2nd Gen)!" -> "wireless-earbuds-2nd-gen"
 * Matches the database rule: lowercase letters and digits separated by single hyphens.
 *
 * @param {string} text
 * @param {number} [maxLength]
 */
export function slugify(text, maxLength = 120) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
