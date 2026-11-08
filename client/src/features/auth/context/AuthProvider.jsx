import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

import { fetchAccount, signOutLocal } from '../services/sessionService';
import { AuthContext } from './AuthContext';

/**
 * Single source of truth for "who is signed in".
 *
 * - `status` is 'loading' until the stored session has been checked AND, for a signed-in
 *   user, their role has been loaded. Guards wait on this, so there is no flash of the
 *   login page and no moment where a role is guessed.
 * - A password-recovery session (from the reset email link) is NOT a login: it is treated as
 *   anonymous until it ends, so it can never open protected pages.
 */
export default function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser((current) => current ?? data?.session?.user ?? null);
      setReady(true);
    });

    // Keep this callback synchronous: calling Supabase from inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const effectiveUser = recovery ? null : user;
  const userId = effectiveUser?.id ?? null;

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchAccount(userId).then((loaded) => {
      if (active) setAccount(loaded);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await signOutLocal();
    setUser(null);
    setRecovery(false);
    setAccount(null);
  }, []);

  const value = useMemo(() => {
    const accountReady = Boolean(userId) && account?.userId === userId;
    /** @type {import('./AuthContext').AuthStatus} */
    let status = 'loading';
    if (ready && !userId) status = 'anonymous';
    else if (ready && accountReady) status = 'authenticated';

    const role = status === 'authenticated' ? account.role : null;
    return {
      status,
      user: userId ? effectiveUser : null,
      account: status === 'authenticated' ? account : null,
      role,
      isAdmin: role === 'admin',
      signOut,
    };
  }, [ready, userId, effectiveUser, account, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
