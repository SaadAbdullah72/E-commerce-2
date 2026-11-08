import { supabase } from '@/lib/supabase/client';

import { mapAuthError } from '../lib/authErrors';
import { getPasswordError } from '../validation/password';
import { normalizeEmail, validateEmail } from '../validation/signup';

/**
 * @typedef {{ code: string, message: string }} AuthFailure
 */

/** Where the reset email sends the user. Must be in Supabase's Redirect URLs list. */
function resetUrl() {
  return `${window.location.origin}/auth/reset`;
}

/**
 * Ask Supabase to email a password-reset link.
 *
 * Never reveals whether the address has an account:
 *  - an unknown address succeeds exactly like a known one (Supabase does this itself);
 *  - a "too many requests" answer is also reported as success. Supabase only throttles
 *    addresses that really exist, so showing that error would tell an attacker which
 *    addresses are registered. The UI starts its cooldown in both cases.
 * Only problems that do not depend on the address (no network, outages) are reported.
 *
 * @param {string} email
 * @returns {Promise<{ ok: true } | { ok: false, error: AuthFailure }>}
 */
export async function requestPasswordReset(email) {
  const invalid = validateEmail(email);
  if (invalid) return { ok: false, error: { code: 'invalid_email', message: invalid } };

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: resetUrl(),
    });

    if (!error) return { ok: true };

    const mapped = mapAuthError(error);
    if (mapped.code === 'rate_limited') return { ok: true };
    return { ok: false, error: mapped };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

/**
 * Check the one-time token from the reset email. On success Supabase starts a temporary
 * "recovery" session in this browser, which is what allows setting a new password.
 * The token type is fixed here, never taken from the URL.
 *
 * @param {string} tokenHash
 * @returns {Promise<{ ok: true } | { ok: false, error: AuthFailure }>}
 */
export async function verifyRecoveryToken(tokenHash) {
  if (!tokenHash || typeof tokenHash !== 'string') {
    return { ok: false, error: mapAuthError({ code: 'otp_expired' }) };
  }

  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) return { ok: false, error: mapAuthError(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

/**
 * Set the new password, then end EVERY session (this browser and all other devices) so the
 * user must sign in again with the new password. The password rules are checked here too,
 * and Supabase enforces them again on the server.
 *
 * @param {string} newPassword
 * @returns {Promise<
 *   { ok: true, otherSessionsRevoked: boolean } | { ok: false, error: AuthFailure }
 * >}
 */
export async function updatePassword(newPassword) {
  const problem = getPasswordError(newPassword);
  if (problem) return { ok: false, error: { code: 'weak_password', message: problem } };

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: mapAuthError(error) };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  // The password IS changed now. Failing to end other sessions must not look like a failure.
  let otherSessionsRevoked = true;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) otherSessionsRevoked = false;
  } catch {
    otherSessionsRevoked = false;
  }

  if (!otherSessionsRevoked) {
    // At least make sure this browser is signed out.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Nothing more can be done from here.
    }
  }

  return { ok: true, otherSessionsRevoked };
}

/**
 * Drop the temporary recovery session from this browser (best effort). Used when the
 * user leaves the reset page without choosing a new password.
 * @returns {Promise<void>}
 */
export async function cancelRecoverySession() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Best effort only.
  }
}
