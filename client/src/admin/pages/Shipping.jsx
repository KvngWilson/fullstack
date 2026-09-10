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
  if (status === "delivered") {
    return "success";
  }
  if (["paid", "shipped"].includes(status)) {
    return "accent";
  }
  if (["cancelled", "refunded"].includes(status)) {
    return "error";
  }
  return "secondary";
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function Shipping() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    orders: [],
    summary: null,
  });

  const loadShipping = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const response = await adminPortalApi.listOrders({ page: 1, pageSize: 50 });
      const payload = response?.data || response || {};
      setState({
        loading: false,
        error: "",
        orders: payload.orders || [],
        summary: payload.summary || {},
      });
    } catch (error) {
      setState({
        loading: false,
        error: getErrorMessage(error, "Failed to load shipping operations."),
        orders: [],
        summary: null,
      });
    }
  };

  useEffect(() => {
    loadShipping();
  }, []);

  const trackingCoverage = useMemo(() => {
    const shippableTotal = Number(state.summary?.shippable_total || 0);
    const trackedShipments = Number(state.summary?.tracked_shipments || 0);

    if (!shippableTotal) {
      return 0;
    }

    return (trackedShipments / shippableTotal) * 100;
  }, [state.summary]);

  const recentShipments = useMemo(
    () =>
      (state.orders || []).filter((order) =>
        ["paid", "shipped", "delivered"].includes(order.status),
      ),
    [state.orders],
  );

  const stats = useMemo(() => {
    const summary = state.summary || {};
    return [
      {
        label: "Dispatched (24h)",
        value: summary.dispatched_last_24h || 0,
        helper: "Shipped or delivered during the last 24 hours",
      },
      {
        label: "Ready to ship",
        value: summary.paid || 0,
        helper: "Paid orders awaiting shipment",
      },
      {
        label: "Delivery exceptions",
        value: summary.overdue_shipments || 0,
        helper: "Shipped orders already past estimated delivery",
      },
      {
        label: "Tracking coverage",
        value: formatPercent(trackingCoverage),
        helper: `${summary.tracked_shipments || 0} tracked of ${summary.shippable_total || 0} shipped/delivered`,
      },
    ];
  }, [state.summary, trackingCoverage]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Shipping</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Live shipment operations
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Track dispatch throughput, tracking coverage, and delivery risk from
          the live order stream used by the rest of the admin workspace.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={loadShipping}>
            Refresh shipping
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.assign("/admin/orders")}
          >
            Open orders
          </Button>
        </div>
      </section>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load shipping"
          message={state.error}
          onRetry={loadShipping}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          className="py-16"
          text="Loading shipment operations..."
        />
      ) : null}

      {!state.loading && state.summary ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="p-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Shipment status mix
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Global counts across the order book.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  ["Ready to ship", state.summary.paid, "accent"],
                  ["In transit", state.summary.shipped, "accent"],
                  ["Delivered", state.summary.delivered, "success"],
                  ["Refunded/cancelled", (state.summary.refunded || 0) + (state.summary.cancelled || 0), "error"],
                ].map(([label, value, variant]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
                  >
                    <Badge variant={variant}>{label}</Badge>
                    <span className="text-lg font-semibold text-slate-900">
                      {value || 0}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                    Recent shipment queue
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Recently updated paid, shipped, and delivered orders.
                  </p>
                </div>
              </div>
              {!recentShipments.length ? (
                <EmptyState
                  className="mt-6"
                  title="No shipment activity yet"
                  message="Recent shipping records will appear here once orders progress past checkout."
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
                          Carrier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tracking
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          ETA
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {recentShipments.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                            #{order.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.user_email || "Guest"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.shipping_carrier || order.shipping_service || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.tracking_number || "Missing"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {order.estimated_delivery_date
                              ? new Date(
                                  order.estimated_delivery_date,
                                ).toLocaleDateString()
                              : "-"}
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
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
