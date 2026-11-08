import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import AuthLoading from './AuthLoading';

/** Only admins (role read from the database) may see the children. */
export default function AdminRoute({ children }) {
  const { status, isAdmin } = useAuth();

  if (status === 'loading') return <AuthLoading />;
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
