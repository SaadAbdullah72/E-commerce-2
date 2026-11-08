import { z } from 'zod';

import { BANNER_THEME_KEYS } from '@/features/banners/lib/themes';

import { fromLocalInput } from './dates';

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//;
// Same rule as the database: an internal path only. No "//", no scheme, a safe character set.
const INTERNAL_PATH = /^\/[A-Za-z0-9/_?=&%.-]*$/;

export const MAX_ACTIVE_BANNERS = { hero: 6, announcement: 10 };

/**
 * The banner form, as typed. One schema covers both kinds; announcements simply do not show
 * (and `toBannerRow` clears) the hero-only fields.
 */
export const bannerSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter some text')
      .max(120, 'Keep it to 120 characters or fewer'),
    badge: z.string().trim().max(40, 'Keep the badge to 40 characters or fewer'),
    subtitle: z.string().trim().max(160, 'Keep the subtitle to 160 characters or fewer'),
    buttonText: z.string().trim().max(30, 'Keep the button text to 30 characters or fewer'),
    linkPath: z.string().trim().max(200, 'The link is too long'),
    theme: z.enum(BANNER_THEME_KEYS),
    sortOrder: z
      .string()
      .trim()
      .regex(/^\d{1,4}$/, 'Enter a whole number from 0 to 1000'),
    isActive: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
    image: z
      .array(
        z.object({
          url: z.string().regex(CLOUDINARY_URL, 'Image address is not valid').max(2048),
          publicId: z.string().min(1).max(255),
          alt: z.string().default(''),
        }),
      )
      .max(1),
  })
  .superRefine((values, context) => {
    const problem = (path, message) => context.addIssue({ code: 'custom', path: [path], message });

    if (
      values.linkPath &&
      (!INTERNAL_PATH.test(values.linkPath) || values.linkPath.includes('//'))
    ) {
      problem(
        'linkPath',
        'Use a page on this site, starting with a single "/", like /category/electronics',
      );
    }
    if (values.buttonText && !values.linkPath)
      problem('linkPath', 'Add a link for the button to open');
    if (Number(values.sortOrder) > 1000)
      problem('sortOrder', 'Enter a whole number from 0 to 1000');

    const starts = fromLocalInput(values.startsAt);
    const ends = fromLocalInput(values.endsAt);
    if (values.startsAt && !starts) problem('startsAt', 'Enter a valid start date');
    if (values.endsAt && !ends) problem('endsAt', 'Enter a valid end date');
    if (starts && ends && ends <= starts) problem('endsAt', 'The end must be after the start');

    if (values.image[0] && !values.image[0].publicId.startsWith('shopyaro/banners/')) {
      problem('image', 'Image is not from the banners folder');
    }
  });

/**
 * @param {z.infer<typeof bannerSchema>} values
 * @param {'hero' | 'announcement'} kind
 */
export function toBannerRow(values, kind) {
  const isHero = kind === 'hero';
  const image = isHero ? (values.image[0] ?? null) : null;
  return {
    kind,
    title: values.title.trim(),
    badge: isHero && values.badge ? values.badge.trim() : null,
    subtitle: isHero && values.subtitle ? values.subtitle.trim() : null,
    button_text: isHero && values.buttonText ? values.buttonText.trim() : null,
    link_path: values.linkPath ? values.linkPath.trim() : null,
    image_url: image?.url ?? null,
    image_public_id: image?.publicId ?? null,
    theme: values.theme,
    sort_order: Number(values.sortOrder),
    is_active: values.isActive,
    starts_at: fromLocalInput(values.startsAt),
    ends_at: fromLocalInput(values.endsAt),
  };
}

export const EMPTY_BANNER_VALUES = {
  title: '',
  badge: '',
  subtitle: '',
  buttonText: '',
  linkPath: '',
  theme: 'ocean',
  sortOrder: '0',
  isActive: true,
  startsAt: '',
  endsAt: '',
  image: [],
};
