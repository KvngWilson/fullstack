import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { adminPortalApi } from "@/api/endpoints/adminPortal";
import { getErrorMessage } from "@/utils/getErrorMessage";

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
  if (status === "refunded") {
    return "error";
  }
  if (status === "cancelled") {
    return "secondary";
  }
  if (status === "pending") {
    return "accent";
  }
  return "success";
}

export default function Support() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    customers: [],
    customerSummary: null,
    orders: [],
    orderSummary: null,
  });

  const loadSupport = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [customersResponse, ordersResponse] = await Promise.all([
        adminPortalApi.listCustomers({ page: 1, pageSize: 8 }),
        adminPortalApi.listOrders({ page: 1, pageSize: 20 }),
      ]);
      const customersPayload =
        customersResponse?.data || customersResponse || {};
      const ordersPayload = ordersResponse?.data || ordersResponse || {};

      setState({
        loading: false,
        error: "",
        customers: customersPayload.users || [],
        customerSummary: customersPayload.summary || {},
        orders: ordersPayload.orders || [],
        orderSummary: ordersPayload.summary || {},
      });
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, "Failed to load support operations."),
        customers: [],
        customerSummary: null,
        orders: [],
        orderSummary: null,
      });
    }
  };

  useEffect(() => {
    loadSupport();
  }, []);

  const followUpOrders = useMemo(
    () =>
      (state.orders || []).filter((order) =>
        ["pending", "cancelled", "refunded"].includes(order.status),
      ),
    [state.orders],
  );

  const stats = useMemo(() => {
    const customers = state.customerSummary || {};
    const orders = state.orderSummary || {};
    return [
      {
        label: "Customer accounts",
        value: customers.total || 0,
        helper: `${customers.new_last_30 || 0} new in the last 30 days`,
      },
      {
        label: "Recently active",
        value: customers.active || 0,
        helper: "Signed in within the last 7 days",
      },
      {
        label: "Pending follow-up orders",
        value:
          (orders.pending || 0) + (orders.cancelled || 0) + (orders.refunded || 0),
        helper: "Pending, cancelled, and refunded orders",
      },
      {
        label: "Resolved deliveries",
        value: orders.delivered || 0,
        helper: "Orders completed successfully",
      },
    ];
  }, [state.customerSummary, state.orderSummary]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Support</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Live customer support operations
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Work from the live user and order streams to prioritize follow-up,
          monitor account activity, and keep customer-facing issues moving.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={loadSupport}>
            Refresh support
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.assign("/admin/users")}
          >
            Open users
          </Button>
        </div>
      </section>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load support"
          message={state.error}
          onRetry={loadSupport}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          className="py-16"
          text="Loading support operations..."
        />
      ) : null}

      {!state.loading && (state.customerSummary || state.orderSummary) ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                    Customers needing context
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Latest registered customers and recent account activity.
                  </p>
                </div>
              </div>
              {!state.customers.length ? (
                <EmptyState
                  className="mt-6"
                  title="No customers found"
                  message="Customer records will appear here once accounts are created."
                />
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {state.customers.map((user) => (
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
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                    Follow-up order queue
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Orders that typically trigger support intervention.
                  </p>
                </div>
              </div>
              {!followUpOrders.length ? (
                <EmptyState
                  className="mt-6"
                  title="No at-risk orders"
                  message="Pending, cancelled, and refunded orders will appear here."
                />
              ) : (
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
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {followUpOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                            #{order.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.user_email || "Guest"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={statusVariant(order.status)}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.updated_at
                              ? new Date(order.updated_at).toLocaleDateString()
                              : order.created_at
                                ? new Date(order.created_at).toLocaleDateString()
                                : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
