import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { adminPortalApi } from "@/api/endpoints/adminPortal";
import { getErrorMessage } from "@/utils/getErrorMessage";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function StatCard({ label, value, helper }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 font-heading text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </Card>
  );
}

function statusVariant(status) {
  if (["paid", "delivered"].includes(status)) {
    return "success";
  }
  if (["pending", "shipped"].includes(status)) {
    return "accent";
  }
  if (["cancelled", "refunded"].includes(status)) {
    return "error";
  }
  return "secondary";
}

export default function Dashboard() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    overview: null,
  });

  const loadOverview = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const response = await adminPortalApi.getDashboardOverview();
      setState({
        loading: false,
        error: "",
        overview: response?.data || response,
      });
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, "Failed to load admin dashboard."),
        overview: null,
      });
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const stats = useMemo(() => {
    const totals = state.overview?.totals || {};
    const recentOrders = state.overview?.recentOrders || [];
    const recentUsers = state.overview?.recentUsers || [];

    return [
      {
        label: "Total users",
        value: totals.total_users || 0,
        helper: `${recentUsers.length} most recent accounts loaded`,
      },
      {
        label: "Active products",
        value: totals.active_products || 0,
        helper: "Currently visible catalog items",
      },
      {
        label: "Total orders",
        value: totals.total_orders || 0,
        helper: `${recentOrders.length} recent orders in view`,
      },
      {
        label: "Captured revenue",
        value: formatCurrency(totals.total_revenue),
        helper: "Paid orders only",
      },
    ];
  }, [state.overview]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Live overview</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Marketplace command center
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Review live customer, product, order, and revenue data from the same
          backend services that previously powered the SSR admin.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={loadOverview}>
            Refresh dashboard
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.assign("/admin/orders")}
          >
            Review orders
          </Button>
        </div>
      </section>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load dashboard"
          message={state.error}
          onRetry={loadOverview}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          className="py-16"
          text="Loading platform overview..."
        />
      ) : null}

      {!state.loading && state.overview ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="p-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Order status mix
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Live counts across all orders.
              </p>
              <div className="mt-6 space-y-3">
                {(state.overview.orderStatusBreakdown || []).map((entry) => (
                  <div
                    key={entry.status}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
                  >
                    <Badge variant={statusVariant(entry.status)}>
                      {entry.status}
                    </Badge>
                    <span className="text-lg font-semibold text-slate-900">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                    Recent orders
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Latest order activity across the platform.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.assign("/admin/orders")}
                >
                  Open orders
                </Button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(state.overview.recentOrders || []).map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          #{order.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {order.user_email || "Guest"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={statusVariant(order.status)}>
                            {order.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section className="mt-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Recent customer accounts
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Newest registered accounts surfaced from the live admin service.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(state.overview.recentUsers || []).map((user) => (
                  <div
                    key={user.id}
                    className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Role: {user.role}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Created{" "}
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "Unknown"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last login{" "}
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
