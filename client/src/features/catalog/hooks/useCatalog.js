import { useQuery } from '@tanstack/react-query';

import {
  getProductBySlug,
  listCategories,
  listDealTags,
  listProducts,
  listProductsByIds,
} from '../services/catalogService';

export const catalogKeys = {
  categories: ['catalog', 'categories'],
  dealTags: ['catalog', 'deal-tags'],
  products: (filters) => ['catalog', 'products', filters],
  product: (slug) => ['catalog', 'product', slug],
};

/** @param {object} [filters] see listProducts  @param {{ enabled?: boolean }} [options] */
export function useProducts(filters = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: () => listProducts(filters),
    enabled,
  });
}

/**
 * Live data for a set of products, e.g. the items in the cart. Keeps showing the previous
 * result while a changed id list is loading, so the cart does not flash empty.
 * @param {string[]} ids
 */
export function useProductsByIds(ids) {
  return useQuery({
    queryKey: ['catalog', 'products-by-ids', ids],
    queryFn: () => listProductsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

/** @param {string | undefined} slug */
export function useProduct(slug) {
  return useQuery({
    queryKey: catalogKeys.product(slug),
    queryFn: () => getProductBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: listCategories });
}

export function useDealTags() {
  return useQuery({ queryKey: catalogKeys.dealTags, queryFn: listDealTags });
}
