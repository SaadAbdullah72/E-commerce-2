import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import AuthLoading from './AuthLoading';

/**
 * Only signed-in users may see the children. This controls what the UI shows; the real
 * protection for data is row-level security in the database.
 */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const { pathname } = useLocation();

  if (status === 'loading') return <AuthLoading />;
  if (status === 'anonymous') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />;
  }
  return children;
}
