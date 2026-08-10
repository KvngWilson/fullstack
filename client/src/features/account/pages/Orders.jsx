import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOrdersThunk } from "@/features/orders/ordersThunks";
import {
  selectOrders,
  selectOrdersError,
  selectOrdersIsLoading,
  selectOrdersPagination,
} from "@/features/orders/ordersSelectors";
import AccountHeader from "@/components/layout/AccountHeader";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Card, Badge } from "@/components/ui";
import { paymentsService } from "@/services/paymentService";
import { getStoredCurrency } from "@/preferences";
import { formatPrice } from "@/utils/format";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

export default function Orders() {
  const dispatch = useAppDispatch();
  const orders = useAppSelector(selectOrders);
  const pagination = useAppSelector(selectOrdersPagination);
  const isLoading = useAppSelector(selectOrdersIsLoading);
  const error = useAppSelector(selectOrdersError);
  const [paymentStatusByOrderId, setPaymentStatusByOrderId] = useState({});
  const { t } = useAppPreferences();

  const currency = getStoredCurrency();

  const visibleOrderIds = useMemo(
    () =>
      orders
        .map((order) => Number(order.id))
        .filter((id) => Number.isFinite(id)),
    [orders],
  );

  useEffect(() => {
    dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }));
  }, [dispatch]);

  useEffect(() => {
    let isActive = true;

    const loadPaymentStatuses = async () => {
      if (!visibleOrderIds.length) {
        if (isActive) {
          setPaymentStatusByOrderId({});
        }
        return;
      }

      try {
        const payments = await paymentsService.listPayments({
          page: 1,
          pageSize: 100,
        });

        if (!isActive) return;

        const statuses = {};
        payments.forEach((payment) => {
          const orderId = Number(payment.order_id);
          if (!visibleOrderIds.includes(orderId)) return;

          const createdAt = new Date(payment.created_at || 0).getTime();
          const current = statuses[orderId];

          if (!current || createdAt > current.createdAt) {
            statuses[orderId] = {
              status: payment.status || "pending",
              createdAt,
            };
          }
        });

        const normalized = Object.entries(statuses).reduce((acc, [orderId, value]) => {
          acc[orderId] = value.status;
          return acc;
        }, {});

        setPaymentStatusByOrderId(normalized);
      } catch {
        if (isActive) {
          setPaymentStatusByOrderId({});
        }
      }
    };

    loadPaymentStatuses();

    return () => {
      isActive = false;
    };
  }, [visibleOrderIds]);

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("orders.title")}
        description="Track every order, review payment progress, and jump straight into detailed shipment updates."
        badge="Order history"
        stats={[
          { label: "Visible orders", value: String(orders.length) },
          { label: "Current page", value: String(pagination?.page || 1) },
          { label: "Page size", value: "10" },
        ]}
      />

      {isLoading && (
        <Card className="mt-8">
          <TextBlockSkeleton />
        </Card>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title={t("orders.failedLoad")}
          message={error}
          onRetry={() => dispatch(fetchOrdersThunk({ page: 1, pageSize: 10 }))}
        />
      )}

      {!isLoading && !error && (
        <div className="mt-8 space-y-4">
          {orders.map((order) => (
            <Link key={order.id} to={`/account/orders/${order.id}`} className="block">
              <Card className="hover:-translate-y-1">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                      {t("orders.orderNumber", { id: order.id })}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">
                      {formatPrice(Number(order.total_amount ?? order.total ?? 0), currency)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("orders.trackHint", { id: order.id })}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {t("orders.statusLine", {
                        status: order.status || t("common.pending"),
                        payment:
                          paymentStatusByOrderId[order.id] ||
                          order.payment_status ||
                          t("common.pending"),
                        total: formatPrice(
                          Number(order.total_amount ?? order.total ?? 0),
                          currency,
                        ),
                      })}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {!orders.length && (
            <EmptyState
              title={t("orders.noOrdersTitle")}
              message={t("orders.noOrdersMessage")}
              actionLabel="Browse products"
              onAction={() => {
                window.location.href = "/products";
              }}
            />
          )}

          {pagination && (
            <p className="text-sm text-slate-500">
              {t("common.pageOf", {
                page: pagination.page,
                totalPages: pagination.totalPages,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
