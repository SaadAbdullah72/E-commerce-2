import { z } from 'zod';

import { SLUG_PATTERN } from './slugify';

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Name must be 80 characters or fewer'),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a slug')
    .max(80, 'Slug must be 80 characters or fewer')
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens'),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, 'Enter a whole number from 0 to 9999'),
  isActive: z.boolean(),
  icon: z
    .array(
      z.object({
        url: z.string().regex(CLOUDINARY_URL, 'Icon address is not valid').max(2048),
        publicId: z.string().min(1).max(255),
        alt: z.string().default(''),
      }),
    )
    .max(1, 'A category has one icon'),
});

/** @param {z.infer<typeof categorySchema>} values */
export function toCategoryRow(values) {
  const icon = values.icon[0] ?? null;
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    sort_order: Number(values.sortOrder),
    is_active: values.isActive,
    icon_url: icon?.url ?? null,
    icon_public_id: icon?.publicId ?? null,
  };
}

export const EMPTY_CATEGORY_VALUES = {
  name: '',
  slug: '',
  sortOrder: '0',
  isActive: true,
  icon: [],
};
