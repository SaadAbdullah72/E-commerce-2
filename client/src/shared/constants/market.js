/**
 * Everything that depends on WHICH MARKET the shop sells in lives here, so switching
 * markets is a one-file change.
 *
 * TODO(market): the client has not confirmed the market yet. Values below are USD.
 *   Pakistan -> currency 'PKR' (₨), locale 'en-PK'
 *   Nigeria  -> currency 'NGN' (₦), locale 'en-NG'
 * Also revisit: the "Under $5 Store" label/limit, and any hard-coded "$" left in the cart,
 * checkout and admin screens (cart/checkout are converted in R4/R5, admin in Admin Phase 1).
 * Note: Intl shows PKR without decimals (1299 -> "PKR 13"); decide the display rule then.
 */
export const MARKET = {
  currency: 'USD',
  locale: 'en-US',
  /** Prices are stored as whole minor units (cents). 1299 = 12.99 */
  minorUnitsPerMajor: 100,
};

/** TODO(market): the "Under $5 Store" deal rule: label shown in the menu, and its price limit. */
export const UNDER_STORE_LABEL = 'under $5 store';
export const UNDER_STORE_MAX_PRICE_MINOR = 500;

/**
 * TODO(market): PLACEHOLDER delivery fee. The old pages showed a hard-coded "4,800" in naira.
 * Real delivery rates (per region / courier) are designed in R5 (checkout). Until then
 * every non-local order gets this flat amount, in whole cents.
 */
export const STANDARD_DELIVERY_FEE_MINOR = 480;
