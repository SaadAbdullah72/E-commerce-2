import { MARKET } from '@/shared/constants/market';

/**
 * Percentage off, rounded. 0 when there is no real discount.
 * @param {number} priceMinor
 * @param {number | null | undefined} compareAtMinor
 */
export function getDiscountPercent(priceMinor, compareAtMinor) {
  if (!compareAtMinor || compareAtMinor <= priceMinor) return 0;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100);
}

/** @param {any} row a `categories` row */
export function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    iconUrl: row.icon_url ?? null,
  };
}

/** @param {any} row a `deal_tags` row */
export function mapDealTag(row) {
  return { id: row.id, name: row.name, slug: row.slug };
}

/**
 * Turn a database row (with its joined category, images and deal tags) into the shape the
 * storefront pages and the cart already use. Prices are given both ways:
 *  - priceMinor / compareAtPriceMinor: exact, for display via formatMoney()
 *  - price / originalPrice: decimal numbers, because the cart still does its maths with them
 *    (the cart moves to whole minor units in R4)
 *
 * @param {any} row
 */
export function mapProduct(row) {
  const unit = MARKET.minorUnitsPerMajor;
  const priceMinor = row.price_minor;
  const compareAtMinor = row.compare_at_price_minor ?? null;

  const images = [...(row.images ?? [])].sort((a, b) => a.position - b.position);

  return {
    _id: row.id, // the cart and older components key on _id
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    category: row.category?.name ?? '',
    categorySlug: row.category?.slug ?? '',
    categoryId: row.category?.id ?? null,
    priceMinor,
    compareAtPriceMinor: compareAtMinor,
    price: priceMinor / unit,
    originalPrice: compareAtMinor === null ? null : compareAtMinor / unit,
    discountPercent: getDiscountPercent(priceMinor, compareAtMinor),
    currency: (row.currency ?? MARKET.currency).trim(),
    stock: row.stock ?? 0,
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    colors: Array.isArray(row.colors) ? row.colors : [],
    images: images.map((image) => image.url),
    dealTags: (row.product_deal_tags ?? []).map((link) => link.deal_tag?.name).filter(Boolean),
    isFlashDeal: Boolean(row.is_flash_deal),
    flashEndsAt: row.flash_ends_at ?? null,
    ratings: Number(row.rating_avg ?? 0),
    reviewsCount: row.rating_count ?? 0,
  };
}
