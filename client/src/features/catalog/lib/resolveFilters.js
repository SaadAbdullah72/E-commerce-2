import { UNDER_STORE_LABEL, UNDER_STORE_MAX_PRICE_MINOR } from '@/shared/constants/market';

/**
 * The home page filters by free text (search box) or by a label picked in the menu: a
 * category name, a deal-tag name or the special "Under $5 Store" rule. Turn that into the
 * ids the database query needs.
 *
 * @param {{ keyword?: string, selected?: string | null,
 *   categories: { id: string, name: string }[], dealTags: { id: string, name: string }[] }} input
 * @returns {{ filters: object, isUnknown: boolean }} `isUnknown` means a label was chosen
 *   that matches nothing, so the result is empty and no query is needed.
 */
export function resolveFilters({ keyword = '', selected = null, categories, dealTags }) {
  const search = keyword.trim();
  if (search) return { filters: { keyword: search }, isUnknown: false };

  const label = selected?.trim().toLowerCase();
  if (!label) return { filters: {}, isUnknown: false };

  if (label === UNDER_STORE_LABEL) {
    return { filters: { maxPriceMinor: UNDER_STORE_MAX_PRICE_MINOR }, isUnknown: false };
  }

  const category = categories.find((item) => item.name.toLowerCase() === label);
  if (category) return { filters: { categoryId: category.id }, isUnknown: false };

  const tag = dealTags.find((item) => item.name.toLowerCase() === label);
  if (tag) return { filters: { dealTagId: tag.id }, isUnknown: false };

  return { filters: {}, isUnknown: true };
}
