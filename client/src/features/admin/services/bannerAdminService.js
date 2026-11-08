import { supabase } from '@/lib/supabase/client';

import { toLocalInput } from '../lib/dates';
import { friendlySaveError } from './saveErrors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  'id, kind, badge, title, subtitle, button_text, link_path, image_url, image_public_id, theme, sort_order, is_active, starts_at, ends_at';

function mapBanner(row) {
  return {
    id: row.id,
    kind: row.kind,
    badge: row.badge ?? '',
    title: row.title,
    subtitle: row.subtitle ?? '',
    buttonText: row.button_text ?? '',
    linkPath: row.link_path ?? '',
    imageUrl: row.image_url,
    imagePublicId: row.image_public_id,
    theme: row.theme,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

/** Every banner of one kind (including paused and scheduled ones), in display order. */
export async function listAdminBanners(kind) {
  const { data, error } = await supabase
    .from('site_banners')
    .select(COLUMNS)
    .eq('kind', kind)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error("We couldn't load the banners. Please try again.");
  return data.map(mapBanner);
}

/** One banner as form values (plus its kind). Null when it does not exist. */
export async function getAdminBanner(id) {
  if (!UUID_PATTERN.test(id)) return null;
  const { data, error } = await supabase
    .from('site_banners')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error("We couldn't load this banner. Please try again.");
  if (!data) return null;

  const banner = mapBanner(data);
  return {
    kind: banner.kind,
    values: {
      title: banner.title,
      badge: banner.badge,
      subtitle: banner.subtitle,
      buttonText: banner.buttonText,
      linkPath: banner.linkPath,
      theme: banner.theme,
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
      startsAt: toLocalInput(banner.startsAt),
      endsAt: toLocalInput(banner.endsAt),
      image:
        banner.imageUrl && banner.imagePublicId
          ? [{ url: banner.imageUrl, publicId: banner.imagePublicId, alt: '' }]
          : [],
    },
  };
}

/** Create (id = null) or update a banner. */
export async function saveBanner(id, row) {
  const query = id
    ? supabase.from('site_banners').update(row).eq('id', id)
    : supabase.from('site_banners').insert(row);
  const { data, error } = await query.select('id');
  if (error || !data?.length)
    throw new Error(friendlySaveError(error ?? { code: '42501' }, 'banner'));
  return data[0].id;
}

/** Pause / resume. Banners are never deleted. */
export async function setBannerActive(id, isActive) {
  const { data, error } = await supabase
    .from('site_banners')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) {
    // The database refuses to switch on a 7th hero slide / 11th announcement; say why.
    throw new Error(
      isActive
        ? friendlySaveError(error, 'banner').replace(
            /^We could not save the banner\.?/,
            'We could not resume the banner.',
          )
        : 'We could not pause the banner.',
    );
  }
}

/**
 * Swap the display order of two banners (the "move up / down" buttons).
 * @param {{ id: string, sortOrder: number }} first
 * @param {{ id: string, sortOrder: number }} second
 */
export async function swapBannerOrder(first, second) {
  const results = await Promise.all([
    supabase
      .from('site_banners')
      .update({ sort_order: second.sortOrder })
      .eq('id', first.id)
      .select('id'),
    supabase
      .from('site_banners')
      .update({ sort_order: first.sortOrder })
      .eq('id', second.id)
      .select('id'),
  ]);
  if (results.some(({ error, data }) => error || !data?.length)) {
    throw new Error('We could not change the order. Reload and try again.');
  }
}
