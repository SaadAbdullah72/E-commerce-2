import { describe, expect, it } from 'vitest';

import { lightning, productRow } from '@/test/fixtures/catalog';

import { getDiscountPercent, mapCategory, mapDealTag, mapProduct } from './mapProduct';

describe('getDiscountPercent', () => {
  it('rounds the percentage off', () => {
    expect(getDiscountPercent(1299, 4999)).toBe(74);
    expect(getDiscountPercent(1950, 6500)).toBe(70);
  });

  it('is 0 without a real discount', () => {
    expect(getDiscountPercent(1000, null)).toBe(0);
    expect(getDiscountPercent(1000, 1000)).toBe(0);
    expect(getDiscountPercent(1000, 900)).toBe(0);
  });
});

describe('mapProduct', () => {
  it('maps a row to the shape the storefront and cart use', () => {
    const product = mapProduct(
      productRow({
        images: [
          { url: 'https://res.cloudinary.com/demo/image/upload/b.jpg', alt: null, position: 1 },
          { url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', alt: null, position: 0 },
        ],
        product_deal_tags: [{ deal_tag: lightning }],
        is_flash_deal: true,
        flash_ends_at: '2026-12-01T00:00:00Z',
        sizes: ['S', 'M'],
        colors: [{ name: 'Red', hex: '#FF0000' }],
        rating_avg: '4.5',
        rating_count: 10,
      }),
    );

    expect(product).toMatchObject({
      _id: '11111111-1111-4111-8111-111111111111',
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'wireless-bluetooth-earbuds',
      category: 'Electronics',
      categorySlug: 'electronics',
      priceMinor: 1299,
      compareAtPriceMinor: 4999,
      price: 12.99,
      originalPrice: 49.99,
      discountPercent: 74,
      currency: 'USD',
      sizes: ['S', 'M'],
      colors: [{ name: 'Red', hex: '#FF0000' }],
      dealTags: ['Lightning Deals'],
      isFlashDeal: true,
      flashEndsAt: '2026-12-01T00:00:00Z',
      ratings: 4.5,
      reviewsCount: 10,
    });
    expect(product.images).toEqual([
      'https://res.cloudinary.com/demo/image/upload/a.jpg',
      'https://res.cloudinary.com/demo/image/upload/b.jpg',
    ]);
  });

  it('handles a product with no images, no compare price and no tags', () => {
    const product = mapProduct(productRow({ compare_at_price_minor: null }));

    expect(product.images).toEqual([]);
    expect(product.originalPrice).toBeNull();
    expect(product.compareAtPriceMinor).toBeNull();
    expect(product.discountPercent).toBe(0);
    expect(product.dealTags).toEqual([]);
    expect(product.reviewsCount).toBe(0);
  });

  it('is defensive about missing relations and bad JSON columns', () => {
    const product = mapProduct(
      productRow({ category: null, colors: null, sizes: null, images: undefined }),
    );
    expect(product.category).toBe('');
    expect(product.colors).toEqual([]);
    expect(product.sizes).toEqual([]);
    expect(product.images).toEqual([]);
  });
});

describe('mapCategory / mapDealTag', () => {
  it('keep only the fields the UI needs', () => {
    expect(mapCategory({ id: 'c', name: 'N', slug: 's', icon_url: null, extra: 1 })).toEqual({
      id: 'c',
      name: 'N',
      slug: 's',
      iconUrl: null,
    });
    expect(mapDealTag({ id: 't', name: 'N', slug: 's', sort_order: 1 })).toEqual({
      id: 't',
      name: 'N',
      slug: 's',
    });
  });
});
