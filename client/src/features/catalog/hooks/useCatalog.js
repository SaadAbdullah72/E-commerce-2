import { useQuery } from '@tanstack/react-query';

import {
  getProductBySlug,
  listCategories,
  listDealTags,
  listProducts,
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
