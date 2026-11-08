import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

/** Current auth state. Must be used under <AuthProvider>. */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
