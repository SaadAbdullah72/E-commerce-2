import { supabase } from '@/lib/supabase/client';

import { mapCategory, mapDealTag, mapProduct } from '../lib/mapProduct';

const PRODUCT_COLUMNS = [
  'id, slug, title, description, price_minor, compare_at_price_minor, currency, stock',
  'sizes, colors, is_flash_deal, flash_ends_at, rating_avg, rating_count',
  'category:categories(id, name, slug)',
  'images:product_images(url, alt, position)',
].join(', ');

const DEAL_TAGS_EMBED = 'product_deal_tags(deal_tag:deal_tags(id, name, slug))';
// "!inner" turns the embed into a filter: only products that have the chosen tag come back.
const DEAL_TAGS_EMBED_FILTERED = 'product_deal_tags!inner(deal_tag:deal_tags(id, name, slug))';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_KEYWORD_LENGTH = 100;
const MAX_PRODUCTS = 200;

/** Public message: never pass raw database text to the UI. */
function loadError(what) {
  return new Error(`We couldn't load ${what}. Please try again.`);
}

/** Escape the characters that act as wildcards inside a LIKE pattern. */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * List active products (row-level security hides inactive ones from visitors).
 *
 * @param {{ keyword?: string, categoryId?: string, dealTagId?: string,
 *   maxPriceMinor?: number }} [filters]
 */
export async function listProducts({ keyword, categoryId, dealTagId, maxPriceMinor } = {}) {
  const embed = dealTagId ? DEAL_TAGS_EMBED_FILTERED : DEAL_TAGS_EMBED;
  let query = supabase.from('products').select(`${PRODUCT_COLUMNS}, ${embed}`);

  if (categoryId) query = query.eq('category_id', categoryId);
  if (dealTagId) query = query.eq('product_deal_tags.deal_tag_id', dealTagId);
  if (typeof maxPriceMinor === 'number') query = query.lte('price_minor', maxPriceMinor);
  if (keyword?.trim()) {
    const text = keyword.trim().slice(0, MAX_KEYWORD_LENGTH);
    query = query.ilike('title', `%${escapeLike(text)}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(MAX_PRODUCTS);
  if (error) throw loadError('the products');
  return data.map(mapProduct);
}

/**
 * One product by its URL slug, or null when it doesn't exist (or is hidden).
 * @param {string} slug
 */
export async function getProductBySlug(slug) {
  if (typeof slug !== 'string' || slug.length > 120 || !SLUG_PATTERN.test(slug)) return null;

  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, ${DEAL_TAGS_EMBED}`)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw loadError('this product');
  return data ? mapProduct(data) : null;
}

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon_url')
    .order('sort_order', { ascending: true });
  if (error) throw loadError('the categories');
  return data.map(mapCategory);
}

export async function listDealTags() {
  const { data, error } = await supabase
    .from('deal_tags')
    .select('id, name, slug')
    .order('sort_order', { ascending: true });
  if (error) throw loadError('the deals');
  return data.map(mapDealTag);
}
