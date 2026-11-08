import { supabase } from '@/lib/supabase/client';

import { isAlreadyRegisteredError, mapAuthError } from '../lib/authErrors';
import { normalizeEmail, validateSignupForm } from '../validation/signup';

/**
 * @typedef {{ ok: true }} Success
 * @typedef {{ ok: false, error: { code: string, message: string } }} Failure
 */

/** Token types our confirm page is willing to verify. */
export const CONFIRM_TOKEN_TYPES = ['email', 'signup'];

/**
 * Errors that must look exactly like success. Reporting them would tell a stranger
 * whether an address already has an account.
 */
const SILENT_CODES = new Set(['user_not_found']);

/** Where the confirmation email sends the user. Must be in Supabase's Redirect URLs list. */
function confirmUrl() {
  return `${window.location.origin}/auth/confirm`;
}

/**
 * Create an account with email + password.
 *
 * The result NEVER depends on whether the address was already registered: a duplicate
 * returns the same `{ ok: true }` as a new account (Supabase also returns a look-alike
 * user object in that case, which we deliberately ignore).
 *
 * @param {object} input
 * @param {string} input.fullName
 * @param {string} input.email
 * @param {string} input.password
 * @param {boolean} input.termsAccepted
 * @param {string} input.termsVersion
 * @returns {Promise<Success | Failure>}
 */
export async function signUpWithEmail({ fullName, email, password, termsAccepted, termsVersion }) {
  // Defence in depth: never trust that the UI validated.
  const { valid } = validateSignupForm({
    fullName,
    email,
    password,
    confirmPassword: password,
    termsAccepted,
  });
  if (!valid) {
    return {
      ok: false,
      error: { code: 'invalid_input', message: 'Please check the form and try again.' },
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo: confirmUrl(),
        // Profile data only. The role is assigned by a database trigger, never from here.
        data: {
          full_name: fullName.trim(),
          terms_accepted: true,
          terms_version: termsVersion,
        },
      },
    });

    if (error && !isAlreadyRegisteredError(error)) {
      return { ok: false, error: mapAuthError(error) };
    }

    // With "Confirm email" ON there is no session until the link is used. If one comes
    // back, the project setting is wrong: drop it so an unverified user is not signed in.
    if (data?.session) {
      console.warn('Signup returned a session: "Confirm email" looks disabled in Supabase.');
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

/**
 * Send the confirmation email again. Unknown or already-confirmed addresses look like
 * success; only rate limits and network problems are reported.
 *
 * @param {string} email
 * @returns {Promise<Success | Failure>}
 */
export async function resendSignupEmail(email) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: { emailRedirectTo: confirmUrl() },
    });

    if (error && !isAlreadyRegisteredError(error) && !SILENT_CODES.has(error.code)) {
      return { ok: false, error: mapAuthError(error) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

/**
 * Verify the token from the confirmation email.
 *
 * Verifying signs the user in. This phase ends at "please sign in", so the session is
 * dropped locally straight after a successful check, leaving a clean state for login.
 *
 * @param {{ tokenHash: string, type: string }} input
 * @returns {Promise<Success | Failure>}
 */
export async function confirmSignupEmail({ tokenHash, type }) {
  if (!tokenHash || !CONFIRM_TOKEN_TYPES.includes(type)) {
    return { ok: false, error: mapAuthError({ code: 'otp_expired' }) };
  }

  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return { ok: false, error: mapAuthError(error) };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  // The email IS verified at this point; a failed local sign-out must not hide that.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Nothing useful to do: the session lives only in this browser.
  }
  return { ok: true };
}
