import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchOrderByIdThunk,
  trackOrderThunk,
} from "@/features/orders/ordersThunks";
import {
  selectCurrentOrder,
  selectOrderTrackingById,
  selectOrdersError,
  selectOrdersIsLoading,
} from "@/features/orders/ordersSelectors";
import AccountHeader from "@/components/layout/AccountHeader";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Card, Badge } from "@/components/ui";
import { paymentsService } from "@/services/paymentService";
import { getStoredCurrency } from "@/preferences";
import { formatPrice } from "@/utils/format";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";
import useOrderRealtime from "@/features/orders/hooks/useOrderRealtime";
import { notifyInfo } from "@/utils/toast";

export default function OrderDetail() {
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const order = useAppSelector(selectCurrentOrder);
  const trackingByOrderId = useAppSelector(selectOrderTrackingById);
  const isLoading = useAppSelector(selectOrdersIsLoading);
  const error = useAppSelector(selectOrdersError);
  const [paymentStatus, setPaymentStatus] = useState("");
  const { t } = useAppPreferences();

  const currency = getStoredCurrency();
  const orderId = id ? Number(id) : null;

  useEffect(() => {
    if (!id) return;
    dispatch(fetchOrderByIdThunk(Number(id)));
    dispatch(trackOrderThunk(Number(id)));
  }, [dispatch, id]);

  const handleRealtimeUpdate = useCallback(
    (event) => {
      if (!orderId) {
        return;
      }

      dispatch(fetchOrderByIdThunk(orderId));
      dispatch(trackOrderThunk(orderId));
      notifyInfo(`Order #${orderId} updated to ${event?.newStatus || "new status"}`);
    },
    [dispatch, orderId],
  );

  useOrderRealtime(orderId, handleRealtimeUpdate);

  useEffect(() => {
    let isActive = true;

    const loadPaymentStatus = async () => {
      if (!id) {
        if (isActive) setPaymentStatus("");
        return;
      }

      try {
        const latestPayment = await paymentsService.getLatestPaymentForOrder(
          Number(id),
        );
        if (!isActive) return;
        setPaymentStatus(latestPayment?.status || "");
      } catch {
        if (isActive) {
          setPaymentStatus("");
        }
      }
    };

    loadPaymentStatus();

    return () => {
      isActive = false;
    };
  }, [id]);

  const tracking = id
    ? trackingByOrderId[id] || trackingByOrderId[Number(id)]
    : null;

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("orders.orderNumber", { id: id || "—" })}
        description="Review order state, payment progress, and live delivery information in one view."
        badge="Order detail"
        actions={
          <Link className="btn-ghost" to="/account/orders">
            Back to orders
          </Link>
        }
      />

      {isLoading && (
        <Card className="mt-8">
          <TextBlockSkeleton />
        </Card>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title={t("orderDetail.failedLoad")}
          message={error}
          onRetry={() => dispatch(fetchOrderByIdThunk(Number(id)))}
        />
      )}

      {!isLoading && !error && order && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t("orderDetail.status", {
                  status: order.status || t("common.pending"),
                })}
              </Badge>
              <Badge variant="secondary">
                {t("orderDetail.payment", {
                  payment:
                    paymentStatus ||
                    order.payment_status ||
                    t("common.pending"),
                })}
              </Badge>
              <Badge variant="secondary">
                {t("orderDetail.created", {
                  created: order.created_at || t("common.notAvailable"),
                })}
              </Badge>
            </div>

            <p className="mt-5 font-heading text-3xl font-semibold tracking-tight text-slate-950">
              {formatPrice(
                Number(
                  order.total_amount ?? order.net_amount ?? order.total ?? 0,
                ),
                currency,
              )}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t("orderDetail.total", {
                total: formatPrice(
                  Number(
                    order.total_amount ?? order.net_amount ?? order.total ?? 0,
                  ),
                  currency,
                ),
              })}
            </p>
          </Card>

          {tracking ? (
            <Card variant="outline">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                {t("orderDetail.tracking")}
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {t("orderDetail.trackingStatus", {
                  status: tracking.status || t("common.notAvailable"),
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {tracking.tracking_url ? (
                  <a
                    href={tracking.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                  >
                    {t("orderDetail.openTrackingLink")}
                  </a>
                ) : null}
                {id ? (
                  <Link
                    to={`/account/orders/${id}/tracking`}
                    className="btn-ghost"
                  >
                    {t("orderDetail.openFullTrackingPage")}
                  </Link>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {!isLoading && !error && !order && (
        <EmptyState
          title={t("orderDetail.notFoundTitle")}
          message={t("orderDetail.notFoundMessage")}
          className="mt-8"
        />
      )}
    </div>
  );
}
