/** Database-shaped rows used by catalog tests (the old mock data now lives here, as rows). */

export const electronics = { id: 'cat-1', name: 'Electronics', slug: 'electronics', icon_url: null };
export const homeKitchen = {
  id: 'cat-2',
  name: 'Home & Kitchen',
  slug: 'home-kitchen',
  icon_url: null,
};

export const lightning = { id: 'tag-1', name: 'Lightning Deals', slug: 'lightning-deals' };

/** @param {object} [overrides] */
export function productRow(overrides = {}) {
  return {
    id: 'prod-1',
    slug: 'wireless-bluetooth-earbuds',
    title: 'Wireless Bluetooth Earbuds Noise Cancelling',
    description: 'Great sound.',
    price_minor: 1299,
    compare_at_price_minor: 4999,
    currency: 'USD',
    stock: 150,
    sizes: [],
    colors: [],
    is_flash_deal: false,
    flash_ends_at: null,
    rating_avg: 0,
    rating_count: 0,
    category: { id: electronics.id, name: electronics.name, slug: electronics.slug },
    images: [],
    product_deal_tags: [],
    ...overrides,
  };
}
