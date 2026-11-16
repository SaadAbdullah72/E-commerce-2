import {
  BAUCHI_EXCLUSIVE_COURIER,
  BAUCHI_STATE,
  citiesForState,
  STATES,
} from '@/shared/constants/locations';

/**
 * Shipping form values taken from the customer's saved profile (phone and default address).
 * Only values the form can actually show are used: a state or city that is not one of the
 * choices is left empty rather than put in front of a dropdown that cannot display it.
 * The name and email are set by the Shipping page itself.
 *
 * @param {{ phone?: string | null, defaultAddress?: string | null, defaultCity?: string | null,
 *   defaultState?: string | null } | null | undefined} account
 * @returns {{ phone: string, address: string, state: string, city: string, courier: string }}
 */
export function shippingDefaultsFromAccount(account) {
  const state = STATES.includes(account?.defaultState) ? account.defaultState : '';
  const city = citiesForState(state).includes(account?.defaultCity) ? account.defaultCity : '';
  return {
    phone: account?.phone ?? '',
    address: account?.defaultAddress ?? '',
    state,
    city,
    // The local hub has one courier, chosen for the customer exactly as picking the state does.
    courier: state === BAUCHI_STATE ? BAUCHI_EXCLUSIVE_COURIER : '',
  };
}
