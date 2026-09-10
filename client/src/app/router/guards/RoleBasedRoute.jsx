import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store";
import {
  selectAuthIsHydrated,
  selectIsAuthenticated,
  selectUserPermissions,
  selectUserRole,
} from "@/features/auth/authSelectors";
import LoadingSpinner from "@/components/common/LoadingSpinner";

function normalizeValues(values) {
  return (values || []).map((value) => String(value).toLowerCase());
}

export default function RoleBasedRoute({
  allowedRoles,
  requiredPermissions,
  permissionMode = "all",
  children,
}) {
  const isHydrated = useAppSelector(selectAuthIsHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const userRole = (useAppSelector(selectUserRole) || "").toLowerCase();
  const userPermissions = normalizeValues(useAppSelector(selectUserPermissions));
  const normalizedAllowedRoles = normalizeValues(allowedRoles);
  const normalizedRequiredPermissions = normalizeValues(requiredPermissions);

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

  if (!normalizedAllowedRoles.length && !normalizedRequiredPermissions.length) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (normalizedAllowedRoles.length) {
    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (normalizedRequiredPermissions.length) {
    const hasRequiredPermissions =
      permissionMode === "any"
        ? normalizedRequiredPermissions.some((permission) =>
            userPermissions.includes(permission),
          )
        : normalizedRequiredPermissions.every((permission) =>
            userPermissions.includes(permission),
          );

    if (!hasRequiredPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
