/**
 * Shipping details typed on the Shipping page and read again at Checkout.
 *
 * They live in sessionStorage (this tab only, gone when it closes), never localStorage, and are
 * tagged with the user who typed them so another account in the same tab never sees them.
 * They are cleared once an order is paid.
 */
const KEY = 'shopyaro_shipping';
const FIELDS = ['fullName', 'email', 'phone', 'address', 'state', 'city', 'courier', 'notes'];
const REQUIRED = ['fullName', 'email', 'phone', 'address', 'state', 'city'];

/** The old version of this feature kept the same details in localStorage; remove that copy. */
function removeLegacyCopy() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (private windows); nothing to remove then.
  }
}

/**
 * @param {Record<string, unknown>} details
 * @param {string | null | undefined} userId
 */
export function saveShipping(details, userId) {
  removeLegacyCopy();
  const clean = {};
  for (const field of FIELDS)
    clean[field] = typeof details?.[field] === 'string' ? details[field] : '';
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ userId: userId ?? null, details: clean }));
  } catch {
    // Without storage the customer simply retypes the details; nothing else breaks.
  }
}

/**
 * The saved details for this user, or null when there are none (or they are incomplete).
 * @param {string | null | undefined} userId
 * @returns {Record<string, string> | null}
 */
export function loadShipping(userId) {
  removeLegacyCopy();
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (!saved || saved.userId !== (userId ?? null) || typeof saved.details !== 'object')
      return null;

    const details = {};
    for (const field of FIELDS) {
      details[field] = typeof saved.details?.[field] === 'string' ? saved.details[field] : '';
    }
    return REQUIRED.every((field) => details[field].trim() !== '') ? details : null;
  } catch {
    return null;
  }
}

export function clearShipping() {
  removeLegacyCopy();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
