import { supabase } from '@/lib/supabase/client';

import { minorToInput } from '../lib/money';
import { friendlySaveError } from './saveErrors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EDIT_COLUMNS = [
  'id, slug, title, description, category_id, price_minor, compare_at_price_minor, stock',
  'sizes, colors, is_active, is_flash_deal, flash_ends_at',
  'images:product_images(url, public_id, alt, position)',
  'product_deal_tags(deal_tag_id)',
].join(', ');

/** ISO date -> the "YYYY-MM-DDTHH:mm" text a datetime-local input wants (local time). */
function toLocalInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create (id = null) or update a product, with its images and deal tags, in one transaction.
 * @param {string | null} id
 * @param {object} payload from toProductPayload()
 * @returns {Promise<string>} the product id
 */
export async function saveProduct(id, payload) {
  const { data, error } = await supabase.rpc('admin_save_product', {
    p_id: id,
    p_payload: payload,
  });
  if (error || typeof data !== 'string') throw new Error(friendlySaveError(error, 'product'));
  return data;
}

/** Soft delete / restore. Rows are never removed. */
export async function setProductActive(id, isActive) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id');
  // Row-level security hides rows silently, so "nothing updated" must count as a failure.
  if (error || !data?.length) {
    throw new Error(
      isActive ? 'We could not restore the product.' : 'We could not deactivate the product.',
    );
  }
}

/**
 * One product, shaped as form values. Returns null when it does not exist.
 * @param {string} id
 */
export async function getAdminProduct(id) {
  if (!UUID_PATTERN.test(id)) return null;

  const { data, error } = await supabase
    .from('products')
    .select(EDIT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error("We couldn't load this product. Please try again.");
  if (!data) return null;

  const images = [...(data.images ?? [])].sort((a, b) => a.position - b.position);
  return {
    title: data.title,
    slug: data.slug,
    description: data.description ?? '',
    categoryId: data.category_id,
    price: minorToInput(data.price_minor),
    compareAtPrice:
      data.compare_at_price_minor === null ? '' : minorToInput(data.compare_at_price_minor),
    stock: String(data.stock),
    sizes: Array.isArray(data.sizes) ? data.sizes : [],
    colors: Array.isArray(data.colors) ? data.colors : [],
    dealTagIds: (data.product_deal_tags ?? []).map((row) => row.deal_tag_id),
    isActive: data.is_active,
    isFlashDeal: data.is_flash_deal,
    flashEndsAt: toLocalInput(data.flash_ends_at),
    images: images.map((image) => ({
      url: image.url,
      publicId: image.public_id,
      alt: image.alt ?? '',
    })),
  };
}

export async function listAdminDealTags() {
  const { data, error } = await supabase
    .from('deal_tags')
    .select('id, name, is_active')
    .order('sort_order', { ascending: true });
  if (error) throw new Error("We couldn't load the deal tags. Please try again.");
  return data.map((row) => ({ id: row.id, name: row.name, isActive: row.is_active }));
}
