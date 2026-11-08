import { z } from 'zod';

import { parseMoneyToMinor } from './money';
import { SLUG_PATTERN } from './slugify';
import { MAX_IMAGES_PER_PRODUCT } from './uploadRules';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const MAX_STOCK = 1_000_000;

export const imageSchema = z.object({
  url: z.string().regex(CLOUDINARY_URL, 'Image address is not valid').max(2048),
  publicId: z.string().min(1).max(255),
  alt: z.string().trim().max(200, 'Alt text must be 200 characters or fewer').default(''),
});

/**
 * The product form. Everything here is text as typed in the form; `toProductPayload`
 * converts it to what the database function expects (whole cents, ISO dates).
 * The database re-checks all of this, so this schema is for fast, friendly feedback.
 */
export const productSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title')
      .max(200, 'Title must be 200 characters or fewer'),
    slug: z
      .string()
      .trim()
      .min(1, 'Enter a slug')
      .max(120, 'Slug must be 120 characters or fewer')
      .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens'),
    description: z.string().max(5000, 'Description must be 5000 characters or fewer'),
    categoryId: z.string().regex(UUID_PATTERN, 'Choose a category'),
    price: z.string().refine((value) => parseMoneyToMinor(value) !== null, {
      message: 'Enter a price like 12.99 (up to 1,000,000)',
    }),
    compareAtPrice: z
      .string()
      .refine((value) => value.trim() === '' || parseMoneyToMinor(value) !== null, {
        message: 'Enter a price like 19.99, or leave empty',
      }),
    stock: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Enter a whole number, 0 or more')
      .refine((value) => Number(value) <= MAX_STOCK, { message: 'Stock is too large' }),
    sizes: z
      .array(z.string().trim().min(1).max(50, 'Each size must be 50 characters or fewer'))
      .max(20, 'At most 20 sizes'),
    colors: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Colour needs a name').max(50, 'Colour name is too long'),
          hex: z.string().regex(HEX_COLOR, 'Pick a colour'),
        }),
      )
      .max(20, 'At most 20 colours'),
    dealTagIds: z.array(z.string().regex(UUID_PATTERN)).max(20),
    isActive: z.boolean(),
    isFlashDeal: z.boolean(),
    flashEndsAt: z.string(),
    images: z
      .array(imageSchema)
      .max(MAX_IMAGES_PER_PRODUCT, `At most ${MAX_IMAGES_PER_PRODUCT} images`),
  })
  .superRefine((values, context) => {
    const price = parseMoneyToMinor(values.price);
    const compareAt =
      values.compareAtPrice.trim() === '' ? null : parseMoneyToMinor(values.compareAtPrice);
    if (price !== null && compareAt !== null && compareAt < price) {
      context.addIssue({
        code: 'custom',
        path: ['compareAtPrice'],
        message: 'The original price cannot be lower than the sale price',
      });
    }

    const sizeKeys = values.sizes.map((size) => size.trim().toLowerCase());
    if (new Set(sizeKeys).size !== sizeKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['sizes'],
        message: 'Sizes must be different from each other',
      });
    }
    if (values.sizes.join(',').length > 200) {
      context.addIssue({
        code: 'custom',
        path: ['sizes'],
        message: 'Too many sizes (200 characters in total)',
      });
    }

    const colorKeys = values.colors.map((color) => color.name.trim().toLowerCase());
    if (new Set(colorKeys).size !== colorKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['colors'],
        message: 'Colour names must be different',
      });
    }

    if (values.isFlashDeal) {
      if (!values.flashEndsAt || Number.isNaN(new Date(values.flashEndsAt).getTime())) {
        context.addIssue({
          code: 'custom',
          path: ['flashEndsAt'],
          message: 'Choose when the flash deal ends',
        });
      }
    }

    values.images.forEach((image, index) => {
      if (!image.publicId.startsWith('shopyaro/products/')) {
        context.addIssue({
          code: 'custom',
          path: ['images', index],
          message: 'Image is not from the product folder',
        });
      }
    });
  });

/**
 * Validated form values -> the payload for `admin_save_product`.
 * @param {z.infer<typeof productSchema>} values
 */
export function toProductPayload(values) {
  const compareAt =
    values.compareAtPrice.trim() === '' ? null : parseMoneyToMinor(values.compareAtPrice);
  return {
    slug: values.slug.trim(),
    title: values.title.trim(),
    description: values.description.trim() || null,
    category_id: values.categoryId,
    price_minor: parseMoneyToMinor(values.price),
    compare_at_price_minor: compareAt,
    stock: Number(values.stock),
    sizes: values.sizes.map((size) => size.trim()),
    colors: values.colors.map((color) => ({
      name: color.name.trim(),
      hex: color.hex.toUpperCase(),
    })),
    is_active: values.isActive,
    is_flash_deal: values.isFlashDeal,
    flash_ends_at: values.isFlashDeal ? new Date(values.flashEndsAt).toISOString() : null,
    deal_tag_ids: values.dealTagIds,
    images: values.images.map((image) => ({
      url: image.url,
      public_id: image.publicId,
      alt: image.alt.trim() || null,
    })),
  };
}

/** An empty form for "Add product". */
export const EMPTY_PRODUCT_VALUES = {
  title: '',
  slug: '',
  description: '',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  stock: '0',
  sizes: [],
  colors: [],
  dealTagIds: [],
  isActive: true,
  isFlashDeal: false,
  flashEndsAt: '',
  images: [],
};
