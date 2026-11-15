import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getOrder } from '../services/checkoutService';

const POLL_EVERY_MS = 2000;
/** The payment webhook is normally there within seconds; after this we stop waiting. */
export const POLL_FOR_MS = 30_000;

/**
 * One order, re-checked every couple of seconds while it is still waiting for the payment
 * confirmation, for at most POLL_FOR_MS.
 *
 * @param {string | null | undefined} orderId
 * @returns {{ order: object | null | undefined, query: import('@tanstack/react-query').UseQueryResult,
 *   timedOut: boolean }} timedOut: still unpaid after the waiting time
 */
export function useOrder(orderId) {
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLongEnough(true), POLL_FOR_MS);
    return () => clearTimeout(timer);
  }, [orderId]);

  const query = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => getOrder(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (current) =>
      !waitedLongEnough && current.state.data?.status === 'pending_payment' ? POLL_EVERY_MS : false,
  });

  return {
    order: query.data,
    query,
    timedOut: waitedLongEnough && query.data?.status === 'pending_payment',
  };
}
