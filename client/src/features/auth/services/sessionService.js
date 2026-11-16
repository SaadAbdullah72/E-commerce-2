import { supabase } from '@/lib/supabase/client';

/**
 * @typedef {'customer' | 'admin'} AppRole
 * @typedef {{ userId: string, role: AppRole, fullName: string | null, phone: string | null,
 *   defaultAddress: string | null, defaultCity: string | null, defaultState: string | null,
 *   profileMissing: boolean, loadFailed: boolean }} Account
 * profileMissing: the account has no profiles row at all (an old account); there is nothing to edit.
 * loadFailed: the profile could not be read, so the other fields are unknown.
 */

/**
 * Load the signed-in user's own profile and role. Row-level security only lets a user read
 * their own rows, so this cannot return anyone else's data.
 *
 * Fails closed: if anything goes wrong the user is treated as a plain customer. The role is
 * only ever read from the database, never from client-editable metadata.
 *
 * @param {string} userId
 * @returns {Promise<Account>}
 */
export async function fetchAccount(userId) {
  try {
    const [profile, role] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, phone, default_address, default_city, default_state')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);

    if (profile.error || role.error) throw profile.error ?? role.error;

    return {
      userId,
      role: role.data?.role === 'admin' ? 'admin' : 'customer',
      fullName: profile.data?.full_name ?? null,
      phone: profile.data?.phone ?? null,
      defaultAddress: profile.data?.default_address ?? null,
      defaultCity: profile.data?.default_city ?? null,
      defaultState: profile.data?.default_state ?? null,
      profileMissing: profile.data === null,
      loadFailed: false,
    };
  } catch {
    return {
      userId,
      role: 'customer',
      fullName: null,
      phone: null,
      defaultAddress: null,
      defaultCity: null,
      defaultState: null,
      profileMissing: false,
      loadFailed: true,
    };
  }
}

/** End this browser's session. Never throws. */
export async function signOutLocal() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // The local session is cleared even when the network call fails.
  }
}
