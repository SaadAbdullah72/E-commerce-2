import { STANDARD_DELIVERY_FEE_MINOR } from '@/shared/constants/market';

/** TODO(market): the one state with free local delivery. Mirrors delivery_fee_for() in migration 0009. */
export const FREE_DELIVERY_STATE = 'Bauchi State (Primary Local Hub)';

/**
 * ESTIMATE only, for showing before payment. The real fee is decided by the database when the
 * order is placed (delivery_fee_for in 0009) and is what the customer is charged. Keep both in step.
 *
 * @param {string | null | undefined} state
 */
export function estimateDeliveryFeeMinor(state) {
  return state === FREE_DELIVERY_STATE ? 0 : STANDARD_DELIVERY_FEE_MINOR;
}
