import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cancelMyOrder } from '../services/orderService';

/**
 * Cancel an unpaid order. Whatever the answer, the order lists are re-read so they show the real
 * status, and product pages are re-read because the stock was given back.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelMyOrder,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
