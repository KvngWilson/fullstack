import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { adminPortalApi } from "@/api/endpoints/adminPortal";
import { getErrorMessage } from "@/utils/getErrorMessage";

const statusOptions = [
  "",
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

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

export default function Orders() {
  const [filters, setFilters] = useState({ status: "", page: 1, pageSize: 20 });
  const [state, setState] = useState({
    loading: true,
    error: "",
    savingOrderId: null,
    orders: [],
    summary: null,
    meta: null,
  });

  const loadOrders = useCallback(async (nextFilters) => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const response = await adminPortalApi.listOrders(nextFilters);
      const payload = response?.data || response || {};
      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        orders: payload.orders || [],
        summary: payload.summary || null,
        meta: response?.meta || payload.meta || null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, "Failed to load admin orders."),
      }));
    }
  }, []);

  useEffect(() => {
    loadOrders(filters);
  }, [filters, loadOrders]);

  const stats = useMemo(() => {
    const summary = state.summary || {};
    return [
      {
        label: "Total orders",
        value: summary.total || 0,
        helper: "All order records",
      },
      {
        label: "Pending",
        value: summary.pending || 0,
        helper: "Awaiting action",
      },
      {
        label: "Paid",
        value: summary.paid || 0,
        helper: "Revenue captured",
      },
      {
        label: "Revenue",
        value: formatCurrency(summary.total_revenue),
        helper: "Across all orders",
      },
    ];
  }, [state.summary]);

  const handleStatusChange = async (orderId, status) => {
    setState((current) => ({
      ...current,
      savingOrderId: orderId,
      error: "",
    }));

    try {
      await adminPortalApi.updateOrderStatus(orderId, { status });
      await loadOrders(filters);
    } catch (error) {
      setState((current) => ({
        ...current,
        savingOrderId: null,
        error: getErrorMessage(error, "Failed to update order status."),
      }));
      return;
    }

    setState((current) => ({
      ...current,
      savingOrderId: null,
    }));
  };

  const page = state.meta?.page || filters.page;
  const totalPages = state.meta?.totalPages || 1;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Orders</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Live order and transaction operations
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          This route now carries the live order queue plus the revenue and
          status summaries that previously lived in the SSR transactions view.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="w-full lg:w-72">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <Select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All statuses</option>
              {statusOptions
                .filter(Boolean)
                .map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Page size
            </label>
            <Select
              value={String(filters.pageSize)}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  pageSize: Number(event.target.value),
                  page: 1,
                }))
              }
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => loadOrders(filters)}>
            Refresh
          </Button>
        </div>
      </Card>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load orders"
          message={state.error}
          onRetry={() => loadOrders(filters)}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          text="Loading order operations..."
          className="py-16"
        />
      ) : null}

      {!state.loading && !state.orders.length ? (
        <EmptyState
          className="mt-6"
          title="No orders found"
          message="Try adjusting the current status filter."
        />
      ) : null}

      {!state.loading && state.orders.length ? (
        <Card className="mt-6 p-6">
          <div className="overflow-x-auto">
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
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Update
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {state.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      #{order.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {order.user_email || "Guest"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={order.status}
                          onChange={(event) =>
                            handleStatusChange(order.id, event.target.value)
                          }
                          disabled={state.savingOrderId === order.id}
                        >
                          {statusOptions
                            .filter(Boolean)
                            .map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Page {page} of {Math.max(1, totalPages)}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() =>
                  setFilters((current) => ({ ...current, page: current.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  setFilters((current) => ({ ...current, page: current.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
