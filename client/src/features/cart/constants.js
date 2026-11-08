/** Most units of one product a customer can put in the cart. */
export const MAX_QTY_PER_ITEM = 10;

/** Most separate lines (product + size + colour) kept in the cart. */
export const MAX_CART_LINES = 50;

/** Browser storage: current key (versioned) and the old ones that are thrown away. */
export const CART_STORAGE_KEY = 'shopyaro:cart:v2';
export const LEGACY_CART_STORAGE_KEYS = ['shopyaro_cart'];
