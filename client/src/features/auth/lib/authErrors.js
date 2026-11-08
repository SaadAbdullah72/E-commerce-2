/**
 * Turns Supabase Auth errors into safe, user-facing messages.
 *
 * Rules:
 *  - Never show raw server text (it can be technical or leak internals).
 *  - Never reveal whether an account exists.
 *  - Unknown errors fall back to a generic message.
 */

import { PASSWORD_MIN_LENGTH } from '../validation/password';

/**
 * @typedef {'network' | 'rate_limited' | 'weak_password' | 'same_password' | 'invalid_email'
 *   | 'link_expired' | 'signup_disabled' | 'unknown'} AuthErrorCode
 */

const MESSAGES = {
  network: "Can't reach the server. Check your internet connection and try again.",
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  weak_password: `That password doesn't meet the requirements. Use at least ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a lowercase letter and a number.`,
  same_password: 'Your new password must be different from your current one.',
  invalid_email: 'Enter a valid email address.',
  link_expired: 'This link is invalid or has expired.',
  signup_disabled: 'New account registration is currently unavailable.',
  unknown: 'Something went wrong. Please try again.',
};

const RATE_LIMIT_CODES = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
]);

const LINK_EXPIRED_CODES = new Set([
  'otp_expired',
  'flow_state_expired',
  'flow_state_not_found',
  'invalid_otp',
  // A password-reset session that has timed out or been revoked.
  'session_not_found',
  'session_expired',
  'bad_jwt',
]);

/** @param {any} error */
function isNetworkError(error) {
  return (
    error?.name === 'AuthRetryableFetchError' ||
    error instanceof TypeError ||
    error?.status === 0 ||
    /failed to fetch|network/i.test(error?.message ?? '')
  );
}

/**
 * @param {any} error A Supabase AuthError (or any thrown value).
 * @returns {{ code: AuthErrorCode, message: string }}
 */
export function mapAuthError(error) {
  /** @type {AuthErrorCode} */
  let code = 'unknown';

  if (!error) {
    code = 'unknown';
  } else if (isNetworkError(error)) {
    code = 'network';
  } else if (RATE_LIMIT_CODES.has(error.code) || error.status === 429) {
    code = 'rate_limited';
  } else if (error.code === 'weak_password') {
    code = 'weak_password';
  } else if (error.code === 'same_password') {
    code = 'same_password';
  } else if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
    code = 'invalid_email';
  } else if (LINK_EXPIRED_CODES.has(error.code) || error.name === 'AuthSessionMissingError') {
    code = 'link_expired';
  } else if (error.code === 'signup_disabled' || error.code === 'email_provider_disabled') {
    code = 'signup_disabled';
  }

  return { code, message: MESSAGES[code] };
}

/**
 * True when Supabase reports that the email is already registered. Callers MUST
 * treat this exactly like a successful signup so account existence is never revealed.
 * @param {any} error
 */
export function isAlreadyRegisteredError(error) {
  return error?.code === 'user_already_exists' || error?.code === 'email_exists';
}
