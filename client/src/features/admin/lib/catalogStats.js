function count(value, name) {
  const number = Number(value);
  if (value === null || value === undefined || !Number.isFinite(number) || number < 0) {
    throw new Error(`Bad value for ${name}`);
  }
  return number;
}

/**
 * Check and reshape what `admin_catalog_stats()` returns. A missing or malformed number
 * throws, so the page shows an error instead of a made-up 0.
 *
 * @param {any} raw
 */
export function parseCatalogStats(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Bad stats');
  return {
    products: {
      total: count(raw.products?.total, 'products.total'),
      active: count(raw.products?.active, 'products.active'),
      inactive: count(raw.products?.inactive, 'products.inactive'),
    },
    stock: {
      outOfStock: count(raw.stock?.out_of_stock, 'stock.out_of_stock'),
      low: count(raw.stock?.low, 'stock.low'),
      healthy: count(raw.stock?.healthy, 'stock.healthy'),
    },
    inventoryValueMinor: count(raw.inventory_value_minor, 'inventory_value_minor'),
    customers: count(raw.customers, 'customers'),
    byCategory: (Array.isArray(raw.by_category) ? raw.by_category : []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      active: count(row.active, 'by_category.active'),
      inactive: count(row.inactive, 'by_category.inactive'),
    })),
    signups: (Array.isArray(raw.signups_30d) ? raw.signups_30d : []).map((row) => ({
      day: String(row.day),
      count: count(row.count, 'signups.count'),
    })),
  };
}
