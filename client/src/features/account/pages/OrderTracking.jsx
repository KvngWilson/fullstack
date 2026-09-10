import { useCallback, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { trackOrderThunk } from "@/features/orders/ordersThunks";
import {
  selectOrderTrackingById,
  selectOrdersError,
  selectOrdersIsLoading,
} from "@/features/orders/ordersSelectors";
import AccountHeader from "@/components/layout/AccountHeader";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Card, Badge } from "@/components/ui";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";
import useOrderRealtime from "@/features/orders/hooks/useOrderRealtime";
import { notifyInfo } from "@/utils/toast";

export default function OrderTracking() {
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const trackingByOrderId = useAppSelector(selectOrderTrackingById);
  const isLoading = useAppSelector(selectOrdersIsLoading);
  const error = useAppSelector(selectOrdersError);
  const { t } = useAppPreferences();
  const orderId = id ? Number(id) : null;

  useEffect(() => {
    if (!id) return;
    dispatch(trackOrderThunk(Number(id)));
  }, [dispatch, id]);

  const handleRealtimeUpdate = useCallback(
    (event) => {
      if (!orderId) {
        return;
      }

      dispatch(trackOrderThunk(orderId));
      notifyInfo(`Tracking updated: order #${orderId} is now ${event?.newStatus || "updated"}`);
    },
    [dispatch, orderId],
  );

  useOrderRealtime(orderId, handleRealtimeUpdate);

  const tracking = id
    ? trackingByOrderId[id] || trackingByOrderId[Number(id)]
    : null;

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("orderTracking.title")}
        description="Get the latest shipment updates and jump to the carrier when a live tracking URL is available."
        badge="Shipment tracking"
        actions={
          <Link className="btn-ghost" to={`/account/orders/${id}`}>
            {t("orderTracking.backToOrder")}
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
          title={t("orderTracking.failedLoad")}
          message={error}
          onRetry={() => dispatch(trackOrderThunk(Number(id)))}
        />
      )}

      {!isLoading && !error && tracking && (
        <Card className="mt-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {t("orderTracking.status", {
                status: tracking.status || t("common.notAvailable"),
              })}
            </Badge>
            <Badge variant="secondary">
              {t("orderTracking.lastUpdate", {
                lastUpdate: tracking.updated_at || t("common.notAvailable"),
              })}
            </Badge>
          </div>

          {tracking.tracking_url ? (
            <a
              href={tracking.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-6"
            >
              {t("orderTracking.openCarrierLink")}
            </a>
          ) : null}
        </Card>
      )}

      {!isLoading && !error && !tracking && (
        <EmptyState
          className="mt-8"
          title={t("orderTracking.notFoundTitle")}
          message={t("orderTracking.notFoundMessage")}
        />
      )}
    </div>
  );
}
