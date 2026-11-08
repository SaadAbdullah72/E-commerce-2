import { createContext } from 'react';

/**
 * @typedef {'loading' | 'authenticated' | 'anonymous'} AuthStatus
 * @typedef {{
 *   status: AuthStatus,
 *   user: import('@supabase/supabase-js').User | null,
 *   account: import('../services/sessionService').Account | null,
 *   role: 'customer' | 'admin' | null,
 *   isAdmin: boolean,
 *   signOut: () => Promise<void>,
 * }} AuthValue
 */

/** @type {import('react').Context<AuthValue | null>} */
export const AuthContext = createContext(null);
