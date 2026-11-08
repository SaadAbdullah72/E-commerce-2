import { supabase } from '@/lib/supabase/client';

import { mapAuthError } from '../lib/authErrors';
import { normalizeEmail, validateEmail } from '../validation/signup';

/**
 * One message for "wrong password" AND "no such account", so the login form can never be
 * used to find out which addresses are registered.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.';

export const EMAIL_NOT_CONFIRMED_MESSAGE =
  'Please confirm your email address first. Check your inbox for the confirmation link.';

/**
 * @typedef {{ code: string, message: string }} LoginFailure
 */

/**
 * Sign in with email + password.
 *
 * Only checks that something was typed. Password strength rules are NOT applied here:
 * they belong to signup, and older accounts must still be able to sign in.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ ok: true } | { ok: false, error: LoginFailure }>}
 */
export async function signInWithEmail({ email, password }) {
  const invalid = validateEmail(email);
  if (invalid) return { ok: false, error: { code: 'invalid_email', message: invalid } };
  if (typeof password !== 'string' || password === '') {
    return { ok: false, error: { code: 'missing_password', message: 'Enter your password.' } };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (!error) return { ok: true };

    if (error.code === 'invalid_credentials') {
      return {
        ok: false,
        error: { code: 'invalid_credentials', message: INVALID_CREDENTIALS_MESSAGE },
      };
    }
    if (error.code === 'email_not_confirmed') {
      return {
        ok: false,
        error: { code: 'email_not_confirmed', message: EMAIL_NOT_CONFIRMED_MESSAGE },
      };
    }
    return { ok: false, error: mapAuthError(error) };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}
