import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { adminPortalApi } from "@/api/endpoints/adminPortal";
import { getErrorMessage } from "@/utils/getErrorMessage";

function resolveOpsPortalUrl() {
  if (typeof window === "undefined") {
    return "http://admin.localhost:5000/dashboard";
  }

  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//admin.localhost:5000/dashboard`;
  }

  return `${protocol}//admin.${hostname}/dashboard`;
}

export default function Settings() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    profile: null,
    permissions: [],
  });

  const loadProfile = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const response = await adminPortalApi.getAdminProfile();
      const payload = response?.data || response || {};
      setState({
        loading: false,
        error: "",
        profile: payload.profile || null,
        permissions: payload.permissions || [],
      });
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, "Failed to load admin settings."),
        profile: null,
        permissions: [],
      });
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const displayName = useMemo(() => {
    const profile = state.profile || {};
    const fullName = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return fullName || profile.email || "Admin user";
  }, [state.profile]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Settings & access</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Administrative access and platform boundaries
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Role and permission details from the old SSR admin-role screen now
          live here. Runtime telemetry and maintenance workflows stay in the SSR
          operations portal.
        </p>
      </section>

      <Alert className="mt-6" variant="info" title="Platform operations portal">
        The SSR admin app now focuses on health, queue monitoring, metrics, and
        maintenance tasks.
        <a
          href={resolveOpsPortalUrl()}
          className="ml-2 font-semibold text-sky-700 underline underline-offset-2"
        >
          Open operations portal
        </a>
      </Alert>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load settings"
          message={state.error}
          onRetry={loadProfile}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          className="py-16"
          text="Loading admin profile..."
        />
      ) : null}

      {!state.loading && state.profile ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="p-6">
            <Badge variant="muted" className="normal-case tracking-normal">
              Current admin profile
            </Badge>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
              {displayName}
            </h2>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Email:</span>{" "}
                {state.profile.email || "Unknown"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Role:</span>{" "}
                {state.profile.role || "Unknown"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Phone:</span>{" "}
                {state.profile.phone || "Not set"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Location:</span>{" "}
                {[state.profile.city, state.profile.country]
                  .filter(Boolean)
                  .join(", ") || "Not set"}
              </p>
            </div>
            <Button type="button" className="mt-6" onClick={loadProfile}>
              Refresh access data
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              Effective permissions
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Resolved from the same permission service used by the protected
              admin APIs.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {state.permissions.map((permission) => (
                <Badge
                  key={permission}
                  variant="secondary"
                  className="normal-case tracking-normal"
                >
                  {permission}
                </Badge>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
