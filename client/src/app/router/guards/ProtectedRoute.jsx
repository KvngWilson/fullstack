import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store";
import {
  selectAuthIsHydrated,
  selectIsAuthenticated,
} from "@/features/auth/authSelectors";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectAuthIsHydrated);

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

  return children ? <>{children}</> : <Outlet />;
}
