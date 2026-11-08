import { useMemo } from 'react';

import { useProductsByIds } from '@/features/catalog/hooks/useCatalog';

import { buildLines } from '../lib/cartMath';

/**
 * Stored cart lines joined with live product data (title, image, price, stock).
 *
 * @param {import('../lib/cartMath').CartItem[]} items
 */
export function useCartLines(items) {
  const ids = useMemo(() => [...new Set(items.map((item) => item.productId))].sort(), [items]);
  const query = useProductsByIds(ids);

  const productsById = useMemo(
    () => new Map((query.data ?? []).map((product) => [product.id, product])),
    [query.data],
  );

  let productsState = 'loading';
  if (ids.length === 0 || (query.isSuccess && !query.isPlaceholderData)) productsState = 'ready';
  else if (query.isError) productsState = 'error';

  const lines = useMemo(
    () => buildLines(items, productsById, productsState),
    [items, productsById, productsState],
  );

  return {
    lines,
    productsById,
    isLoading: productsState === 'loading',
    isError: productsState === 'error',
    refetch: query.refetch,
  };
}
