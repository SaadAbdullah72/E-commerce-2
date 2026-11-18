import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isUuid } from '../../checkout/services/checkoutService';
import {
  getAdminOrder,
  getOrderStats,
  listAdminOrders,
  updateAdminOrder,
} from '../services/orderAdminService';

const STALE_MS = 30_000;

export const useAdminOrders = (filters) =>
  useInfiniteQuery({
    queryKey: ['admin', 'orders', 'list', filters],
    queryFn: ({ pageParam }) => listAdminOrders({ ...filters, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 0,
  });

export const useAdminOrder = (orderId) =>
  useQuery({
    queryKey: ['admin', 'orders', 'detail', orderId],
    queryFn: () => getAdminOrder(orderId),
    enabled: isUuid(orderId),
    staleTime: 0,
  });

/**
 * The order numbers. Every caller shares one request (and one 30 second cache); `select` lets
 * each pick just the value it shows.
 *
 * @param {(stats: ReturnType<typeof import('../lib/orderStats').parseOrderStats>) => any} [select]
 */
export const useOrderStats = (select) =>
  useQuery({
    queryKey: ['admin', 'orders', 'stats'],
    queryFn: getOrderStats,
    staleTime: STALE_MS,
    select,
  });

/** Ship, deliver, or change the tracking number. Lists, stats, the log and the customer's own pages refresh. */
export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, tracking }) => updateAdminOrder(id, { status, tracking }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]),
  });
}
