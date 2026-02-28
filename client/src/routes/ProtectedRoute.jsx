import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { selectIsAuthenticated } from '@/features/auth/authSelectors';

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
