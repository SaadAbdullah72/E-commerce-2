/**
 * Password rules for ShopYaro auth.
 *
 * These MUST mirror the Supabase dashboard settings
 * (Authentication -> Sign In / Providers -> Email):
 *   - Minimum password length: 12
 *   - Password requirements: lowercase, uppercase, digits
 * The server is the authority; this file only gives users fast feedback.
 */

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Upper limit enforced on the client. bcrypt only uses the first 72 bytes, so
 * longer passwords are rejected instead of being silently truncated.
 * TODO(verify): confirm Supabase's real maximum before relying on this number.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * @typedef {'length' | 'lowercase' | 'uppercase' | 'digit'} PasswordRuleId
 * @typedef {{ id: PasswordRuleId, label: string, test: (password: string) => boolean }} PasswordRule
 */

/** @type {PasswordRule[]} */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'lowercase', label: 'One lowercase letter', test: (password) => /[a-z]/.test(password) },
  { id: 'uppercase', label: 'One uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { id: 'digit', label: 'One number', test: (password) => /\d/.test(password) },
];

/** @param {string} value */
function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

/**
 * Check a password against the rules.
 * @param {string} password
 * @returns {{ valid: boolean, failedRules: PasswordRuleId[], tooLong: boolean }}
 */
export function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const failedRules = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);
  const tooLong = byteLength(value) > PASSWORD_MAX_BYTES;
  return { valid: failedRules.length === 0 && !tooLong, failedRules, tooLong };
}

/**
 * One-line, user-facing message for a failed password, or null if it is fine.
 * @param {string} password
 * @returns {string | null}
 */
export function getPasswordError(password) {
  if (!password) return 'Enter a password.';
  const { valid, tooLong } = validatePassword(password);
  if (valid) return null;
  if (tooLong) return `Use ${PASSWORD_MAX_BYTES} characters or fewer.`;
  return `Use at least ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a lowercase letter and a number.`;
}

/* -------------------------------------------------------------------------- */
/* Strength estimate (guidance only: submit is gated by validatePassword)      */
/* -------------------------------------------------------------------------- */

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

// Tiny list on purpose: a full breach list would be a dependency or a big
// bundle. Real breached-password checking is a server-side Supabase feature.
const COMMON_FRAGMENTS = [
  'password',
  'passw0rd',
  'qwerty',
  'letmein',
  'welcome',
  'iloveyou',
  'admin',
  'login',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'abc123',
  '123456',
  'shopyaro',
];

/** True if the password contains a run of 4+ identical or consecutive characters. */
function hasRepeatOrSequence(password) {
  const lower = password.toLowerCase();
  let repeat = 1;
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < lower.length; i += 1) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    repeat = diff === 0 ? repeat + 1 : 1;
    ascending = diff === 1 ? ascending + 1 : 1;
    descending = diff === -1 ? descending + 1 : 1;
    if (repeat >= 4 || ascending >= 4 || descending >= 4) return true;
  }
  return false;
}

/**
 * Rough strength score from 0 (empty) to 4 (strong).
 * A password that fails the rules never scores above 1.
 *
 * @param {string} password
 * @param {{ personal?: string[] }} [context] Name/email parts the password should not contain.
 * @returns {{ score: 0 | 1 | 2 | 3 | 4, label: string }}
 */
export function getPasswordStrength(password, { personal = [] } = {}) {
  if (!password) return { score: 0, label: STRENGTH_LABELS[0] };

  const lower = password.toLowerCase();
  let points = 0;

  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (password.length >= 20) points += 1;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) points += 1;
  if (classes === 4) points += 1;

  if (COMMON_FRAGMENTS.some((fragment) => lower.includes(fragment))) points -= 2;
  if (hasRepeatOrSequence(password)) points -= 1;
  if (personal.some((token) => token && token.length >= 3 && lower.includes(token.toLowerCase()))) {
    points -= 1;
  }

  let score = Math.min(4, Math.max(1, points));
  if (!validatePassword(password).valid) score = Math.min(score, 1);

  return { score: /** @type {0|1|2|3|4} */ (score), label: STRENGTH_LABELS[score] };
}
