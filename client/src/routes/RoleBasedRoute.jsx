import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { selectIsAuthenticated, selectUserRole } from '@/features/auth/authSelectors';

export default function RoleBasedRoute({ allowedRoles, children }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const userRole = useAppSelector(selectUserRole);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
