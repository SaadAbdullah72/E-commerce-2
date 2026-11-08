import { describe, expect, it } from 'vitest';

import { categorySchema, toCategoryRow } from './categorySchema';
import { EMPTY_PRODUCT_VALUES, productSchema, toProductPayload } from './productSchema';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const TAG_ID = '33333333-3333-4333-8333-333333333333';
const IMAGE = {
  url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/products/abc.jpg',
  publicId: 'shopyaro/products/abc',
  alt: '',
};

const valid = (overrides = {}) => ({
  ...EMPTY_PRODUCT_VALUES,
  title: 'Wireless Earbuds',
  slug: 'wireless-earbuds',
  categoryId: CATEGORY_ID,
  price: '12.99',
  ...overrides,
});

const errorsOf = (values) => {
  const result = productSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
};

describe('productSchema', () => {
  it('accepts a minimal valid product', () => {
    expect(productSchema.safeParse(valid()).success).toBe(true);
  });

  it('requires title, slug, category and a price', () => {
    const errors = errorsOf(valid({ title: '  ', slug: '', categoryId: '', price: '' }));
    expect(errors.title).toBeTruthy();
    expect(errors.slug).toBeTruthy();
    expect(errors.categoryId).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it('rejects a malformed slug and price', () => {
    expect(errorsOf(valid({ slug: 'Bad Slug' })).slug).toMatch(/lowercase/);
    expect(errorsOf(valid({ price: '-5' })).price).toBeTruthy();
    expect(errorsOf(valid({ price: '1.234' })).price).toBeTruthy();
  });

  it('validates stock as a whole number', () => {
    expect(errorsOf(valid({ stock: '-1' })).stock).toBeTruthy();
    expect(errorsOf(valid({ stock: '1.5' })).stock).toBeTruthy();
    expect(errorsOf(valid({ stock: '' })).stock).toBeTruthy();
    expect(errorsOf(valid({ stock: '5000000' })).stock).toBeTruthy();
    expect(productSchema.safeParse(valid({ stock: '0' })).success).toBe(true);
  });

  it('does not let the original price be lower than the sale price', () => {
    expect(errorsOf(valid({ price: '20.00', compareAtPrice: '10.00' })).compareAtPrice).toMatch(
      /lower/,
    );
    expect(
      productSchema.safeParse(valid({ price: '10.00', compareAtPrice: '20.00' })).success,
    ).toBe(true);
    expect(productSchema.safeParse(valid({ compareAtPrice: '' })).success).toBe(true);
  });

  it('rejects duplicate sizes and colour names, ignoring case', () => {
    expect(errorsOf(valid({ sizes: ['M', 'm'] })).sizes).toBeTruthy();
    expect(
      errorsOf(
        valid({
          colors: [
            { name: 'Red', hex: '#FF0000' },
            { name: 'red', hex: '#EE0000' },
          ],
        }),
      ).colors,
    ).toBeTruthy();
  });

  it('checks the colour hex value', () => {
    expect(errorsOf(valid({ colors: [{ name: 'Red', hex: 'red' }] }))['colors.0.hex']).toBeTruthy();
  });

  it('needs an end date for a flash deal', () => {
    expect(errorsOf(valid({ isFlashDeal: true, flashEndsAt: '' })).flashEndsAt).toBeTruthy();
    expect(
      productSchema.safeParse(valid({ isFlashDeal: true, flashEndsAt: '2030-01-01T10:00' }))
        .success,
    ).toBe(true);
  });

  it('allows at most 8 images and only product-folder images', () => {
    expect(errorsOf(valid({ images: Array(9).fill(IMAGE) })).images).toBeTruthy();
    expect(
      errorsOf(valid({ images: [{ ...IMAGE, publicId: 'shopyaro/categories/abc' }] }))['images.0'],
    ).toBeTruthy();
    expect(
      errorsOf(valid({ images: [{ ...IMAGE, url: 'http://evil.example/a.jpg' }] }))['images.0.url'],
    ).toBeTruthy();
  });
});

describe('toProductPayload', () => {
  it('converts the form into whole cents, ISO dates and snake_case', () => {
    const payload = toProductPayload(
      valid({
        title: '  Wireless Earbuds ',
        description: '  Great sound. ',
        price: '12.99',
        compareAtPrice: '49.99',
        stock: '150',
        sizes: ['S', ' M '],
        colors: [{ name: ' Red ', hex: '#ff0000' }],
        dealTagIds: [TAG_ID],
        isFlashDeal: true,
        flashEndsAt: '2030-01-01T10:00',
        images: [{ ...IMAGE, alt: '  front  ' }],
      }),
    );

    expect(payload).toMatchObject({
      slug: 'wireless-earbuds',
      title: 'Wireless Earbuds',
      description: 'Great sound.',
      category_id: CATEGORY_ID,
      price_minor: 1299,
      compare_at_price_minor: 4999,
      stock: 150,
      sizes: ['S', 'M'],
      colors: [{ name: 'Red', hex: '#FF0000' }],
      is_active: true,
      is_flash_deal: true,
      deal_tag_ids: [TAG_ID],
      images: [{ url: IMAGE.url, public_id: IMAGE.publicId, alt: 'front' }],
    });
    expect(payload.flash_ends_at).toBe(new Date('2030-01-01T10:00').toISOString());
  });

  it('uses null for an empty description, compare price, alt text, and a non-flash end date', () => {
    const payload = toProductPayload(valid({ flashEndsAt: '2030-01-01T10:00', images: [IMAGE] }));
    expect(payload.description).toBeNull();
    expect(payload.compare_at_price_minor).toBeNull();
    expect(payload.flash_ends_at).toBeNull();
    expect(payload.images[0].alt).toBeNull();
  });

  it('never includes fields the browser must not set', () => {
    const payload = toProductPayload(valid());
    for (const field of ['rating_avg', 'rating_count', 'id', 'created_at', 'currency']) {
      expect(payload).not.toHaveProperty(field);
    }
  });
});

describe('categorySchema', () => {
  const category = (overrides = {}) => ({
    name: 'Electronics',
    slug: 'electronics',
    sortOrder: '1',
    isActive: true,
    icon: [],
    ...overrides,
  });

  it('accepts a valid category and converts it to a row', () => {
    const icon = [
      {
        url: 'https://res.cloudinary.com/dk1jm0rwi/image/upload/v1/shopyaro/categories/a.png',
        publicId: 'shopyaro/categories/a',
        alt: '',
      },
    ];
    const values = category({ icon });
    expect(categorySchema.safeParse(values).success).toBe(true);
    expect(toCategoryRow(values)).toEqual({
      name: 'Electronics',
      slug: 'electronics',
      sort_order: 1,
      is_active: true,
      icon_url: icon[0].url,
      icon_public_id: 'shopyaro/categories/a',
    });
  });

  it('uses null icon columns when there is no icon', () => {
    const row = toCategoryRow(category());
    expect(row.icon_url).toBeNull();
    expect(row.icon_public_id).toBeNull();
  });

  it('rejects a bad name, slug and order', () => {
    expect(categorySchema.safeParse(category({ name: ' ' })).success).toBe(false);
    expect(categorySchema.safeParse(category({ slug: 'A B' })).success).toBe(false);
    expect(categorySchema.safeParse(category({ sortOrder: '-1' })).success).toBe(false);
    expect(categorySchema.safeParse(category({ sortOrder: '12345' })).success).toBe(false);
  });
});
