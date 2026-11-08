import { supabase } from '@/lib/supabase/client';

import { friendlySaveError } from './saveErrors';

/**
 * Create (id = null) or update a category. Categories are written directly; the table's
 * row-level security and CHECK constraints are the real protection.
 *
 * @param {string | null} id
 * @param {object} row from toCategoryRow()
 */
export async function saveCategory(id, row) {
  const query = id
    ? supabase.from('categories').update(row).eq('id', id)
    : supabase.from('categories').insert(row);
  const { data, error } = await query.select('id');
  if (error || !data?.length)
    throw new Error(friendlySaveError(error ?? { code: '42501' }, 'category'));
  return data[0].id;
}

/** Soft delete / restore. Rows are never removed. */
export async function setCategoryActive(id, isActive) {
  const { data, error } = await supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) {
    throw new Error(
      isActive ? 'We could not restore the category.' : 'We could not deactivate the category.',
    );
  }
}

/** How many live products would be hidden from the shop if this category is turned off. */
export async function countActiveProductsInCategory(categoryId) {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('is_active', true);
  if (error || typeof count !== 'number') return null;
  return count;
}

/** One category, shaped as form values. Returns null when it does not exist. */
export async function getAdminCategory(id) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, sort_order, is_active, icon_url, icon_public_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error("We couldn't load this category. Please try again.");
  if (!data) return null;
  return {
    name: data.name,
    slug: data.slug,
    sortOrder: String(data.sort_order),
    isActive: data.is_active,
    icon:
      data.icon_url && data.icon_public_id
        ? [{ url: data.icon_url, publicId: data.icon_public_id, alt: '' }]
        : [],
  };
}
