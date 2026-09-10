import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "@/store";
import { selectUserRole } from "@/features/auth/authSelectors";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { ErrorState } from "@/components/common/AsyncState";
import { vendorOnboardingService } from "@/services/vendorOnboardingService";
import { getErrorMessage } from "@/utils/getErrorMessage";

export default function VendorOnboardingRoute({ children }) {
  const role = (useAppSelector(selectUserRole) || "").toLowerCase();
  const location = useLocation();
  const [state, setState] = useState({
    loading: role === "vendor",
    error: "",
    profile: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (role !== "vendor") {
      setState({ loading: false, error: "", profile: null });
      return undefined;
    }

    async function loadProfile() {
      try {
        const response = await vendorOnboardingService.getMyProfile();
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: "",
          profile: response?.data || response,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: getErrorMessage(error, "Failed to load vendor onboarding."),
          profile: null,
        });
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [role]);

  if (role !== "vendor") {
    return children ? <>{children}</> : <Outlet />;
  }

  if (state.loading) {
    return (
      <LoadingSpinner
        fullscreen={false}
        text="Loading vendor workspace..."
        className="py-16"
      />
    );
  }

  if (state.error) {
    return (
      <ErrorState
        className="landing-container mt-8"
        title="Vendor workspace unavailable"
        message={state.error}
      />
    );
  }

  const isOnboardingPath = location.pathname === "/vendor/onboarding";
  const onboardingComplete = Boolean(state.profile?.onboarding_completed);

  if (!onboardingComplete && !isOnboardingPath) {
    return <Navigate to="/vendor/onboarding" replace />;
  }

  if (onboardingComplete && isOnboardingPath) {
    return <Navigate to="/vendor" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
