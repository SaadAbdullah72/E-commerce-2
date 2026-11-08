import { supabase } from '@/lib/supabase/client';

import { mapAuthError } from '../lib/authErrors';
import { getSafeRedirect } from '../lib/safeRedirect';

const REDIRECT_STORAGE_KEY = 'shopyaro:oauth-redirect';

/** Where Google (via Supabase) sends the browser back to. Always our own origin. */
function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Remember where to go after sign-in. Kept in sessionStorage, NOT in the URL, so nothing in
 * the address bar can change the destination. Only allow-listed paths are stored.
 * @param {string | null | undefined} path
 */
function rememberRedirect(path) {
  try {
    window.sessionStorage.setItem(REDIRECT_STORAGE_KEY, getSafeRedirect(path));
  } catch {
    // Storage can be blocked; the user then lands on the home page.
  }
}

/** Read and clear the remembered destination. Always returns an allow-listed path. */
export function consumeOAuthRedirect() {
  try {
    const stored = window.sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    window.sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
    return getSafeRedirect(stored);
  } catch {
    return '/';
  }
}

/**
 * Start "Continue with Google". On success the browser is sent to Google, so this only
 * returns when something went wrong.
 *
 * @param {string | null} [redirectPath] where to go after sign-in (checked against an allow-list)
 * @returns {Promise<{ ok: true } | { ok: false, error: { code: string, message: string } }>}
 */
export async function signInWithGoogle(redirectPath = null) {
  rememberRedirect(redirectPath);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(), queryParams: { prompt: 'select_account' } },
    });
    if (error) return { ok: false, error: mapAuthError(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapAuthError(error) };
  }
}

/**
 * Finish the sign-in after Google sends the user back with ?code=… (or ?error=…).
 *
 * The Supabase client already exchanges the one-time code by itself when it starts, so we
 * must not exchange it a second time. We wait for the client to finish and check the session.
 *
 * @param {{ hasCode: boolean, error: string | null }} params read from the address bar
 * @returns {Promise<{ ok: true } | { ok: false, code: 'cancelled' | 'failed' }>}
 */
export async function completeOAuthCallback({ hasCode, error }) {
  if (error) {
    // The user pressing "Cancel" on Google's screen comes back as access_denied.
    return { ok: false, code: error === 'access_denied' ? 'cancelled' : 'failed' };
  }
  if (!hasCode) return { ok: false, code: 'failed' };

  try {
    // Resolves only after the client has processed the code in the address bar.
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data?.session) return { ok: false, code: 'failed' };
    return { ok: true };
  } catch {
    return { ok: false, code: 'failed' };
  }
}
