import { supabase } from '@/lib/supabase/client';

import { LOW_STOCK_THRESHOLD } from '../lib/adminStats';

/** Public message: never pass raw database text to the UI. */
function loadError(what) {
  return new Error(`We couldn't load ${what}. Please try again.`);
}

const MAX_ADMIN_PRODUCTS = 500;

/**
 * Counts are asked for with `head: true`, so the database sends back a number, not rows.
 * What an admin may read is decided by the database (RLS), not by this code.
 */
const COUNTS = {
  activeProducts: { table: 'products', refine: (query) => query.eq('is_active', true) },
  inactiveProducts: { table: 'products', refine: (query) => query.eq('is_active', false) },
  categories: { table: 'categories', refine: (query) => query },
  customers: { table: 'profiles', refine: (query) => query },
  outOfStock: {
    table: 'products',
    refine: (query) => query.eq('is_active', true).eq('stock', 0),
  },
  lowStock: {
    table: 'products',
    refine: (query) =>
      query.eq('is_active', true).gte('stock', 1).lte('stock', LOW_STOCK_THRESHOLD),
  },
};

export const COUNT_NAMES = Object.keys(COUNTS);

/** @param {keyof typeof COUNTS} name */
export async function getCount(name) {
  const definition = COUNTS[name];
  if (!definition) throw new Error(`Unknown count: ${name}`);
  const { count, error } = await definition.refine(
    supabase.from(definition.table).select('id', { count: 'exact', head: true }),
  );
  if (error || typeof count !== 'number') throw loadError('this number');
  return count;
}

/** Active products that are out of stock or nearly so, lowest stock first. */
export async function listLowStockProducts(limit = 5) {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, title, stock')
    .eq('is_active', true)
    .lte('stock', LOW_STOCK_THRESHOLD)
    .order('stock', { ascending: true })
    .limit(limit);
  if (error) throw loadError('the stock list');
  return data.map((row) => ({ id: row.id, slug: row.slug, title: row.title, stock: row.stock }));
}

/** Every product, including inactive (soft-deleted) ones, newest first. */
export async function listAdminProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, slug, title, price_minor, currency, stock, is_active, category:categories(name), images:product_images(url, position)',
    )
    .order('created_at', { ascending: false })
    .limit(MAX_ADMIN_PRODUCTS);
  if (error) throw loadError('the products');

  return data.map((row) => {
    const images = [...(row.images ?? [])].sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      priceMinor: row.price_minor,
      currency: row.currency,
      stock: row.stock,
      isActive: row.is_active,
      category: row.category?.name ?? '',
      image: images[0]?.url ?? null,
    };
  });
}

export async function listAdminCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, is_active, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw loadError('the categories');
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
}
