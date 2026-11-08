import { supabase } from '@/lib/supabase/client';

/**
 * The banners visitors may see. The database itself hides paused and out-of-schedule
 * banners (row-level security), so this only needs to ask for a kind.
 *
 * @param {'hero' | 'announcement'} kind
 */
export async function listLiveBanners(kind) {
  const { data, error } = await supabase
    .from('site_banners')
    .select('id, badge, title, subtitle, button_text, link_path, image_url, theme')
    .eq('kind', kind)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error("We couldn't load the banners.");

  return data.map((row) => ({
    id: row.id,
    badge: row.badge ?? '',
    title: row.title,
    subtitle: row.subtitle ?? '',
    buttonText: row.button_text ?? '',
    linkPath: row.link_path ?? '',
    imageUrl: row.image_url ?? null,
    theme: row.theme,
  }));
}
