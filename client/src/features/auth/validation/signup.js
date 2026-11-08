import { getPasswordError } from './password';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-case and trim an email so the same address is always sent the same way. */
export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** @returns {string | null} an error message, or null when valid */
export function validateFullName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return 'Enter your full name.';
  if (value.length < NAME_MIN_LENGTH) return `Use at least ${NAME_MIN_LENGTH} characters.`;
  if (value.length > NAME_MAX_LENGTH) return `Use ${NAME_MAX_LENGTH} characters or fewer.`;
  if (CONTROL_CHARS.test(value)) return 'Your name contains invalid characters.';
  return null;
}

/** @returns {string | null} an error message, or null when valid */
export function validateEmail(email) {
  const value = normalizeEmail(email);
  if (!value) return 'Enter your email address.';
  if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email address.';
  }
  return null;
}

/** @returns {string | null} an error message, or null when valid */
export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Confirm your password.';
  if (password !== confirmPassword) return "Passwords don't match.";
  return null;
}

/** @returns {string | null} an error message, or null when valid */
export function validateTerms(accepted) {
  return accepted === true ? null : 'You must accept the Terms and Privacy Policy to continue.';
}

/**
 * Validate the whole signup form.
 * @param {{ fullName: string, email: string, password: string, confirmPassword: string, termsAccepted: boolean }} values
 * @returns {{ valid: boolean, errors: Partial<Record<'fullName'|'email'|'password'|'confirmPassword'|'terms', string>> }}
 */
export function validateSignupForm(values) {
  const errors = {};
  const fullName = validateFullName(values.fullName);
  const email = validateEmail(values.email);
  const password = getPasswordError(values.password);
  const confirmPassword = validateConfirmPassword(values.password, values.confirmPassword);
  const terms = validateTerms(values.termsAccepted);

  if (fullName) errors.fullName = fullName;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (confirmPassword) errors.confirmPassword = confirmPassword;
  if (terms) errors.terms = terms;

  return { valid: Object.keys(errors).length === 0, errors };
}
