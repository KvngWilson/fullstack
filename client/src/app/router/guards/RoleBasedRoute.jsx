import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store";
import {
  selectAuthIsHydrated,
  selectIsAuthenticated,
  selectUserRole,
} from "@/features/auth/authSelectors";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function RoleBasedRoute({ allowedRoles, children }) {
  const isHydrated = useAppSelector(selectAuthIsHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const userRole = (useAppSelector(selectUserRole) || "").toLowerCase();
  const normalizedAllowedRoles = (allowedRoles || []).map((role) =>
    String(role).toLowerCase(),
  );

  if (!isHydrated) {
    return (
      <LoadingSpinner
        fullscreen={false}
        text="Checking session..."
        className="py-16"
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!normalizedAllowedRoles.length) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
