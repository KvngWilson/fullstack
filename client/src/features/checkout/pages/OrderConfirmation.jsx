import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentsService } from "@/services/paymentService";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const { t } = useAppPreferences();
  const [verificationStatus, setVerificationStatus] = useState("idle");
  const [paymentStatus, setPaymentStatus] = useState("");

  const orderId = searchParams.get("order_id");
  const status = searchParams.get("status");
  const processor = searchParams.get("processor");
  const reference =
    searchParams.get("reference") || searchParams.get("session_id");

  const shouldVerify = useMemo(
    () => status === "success" && Boolean(reference),
    [reference, status],
  );

  useEffect(() => {
    let isActive = true;

    const verify = async () => {
      if (!shouldVerify) {
        return;
      }

      setVerificationStatus("loading");

      try {
        const result = await paymentsService.verifyPaymentStatus(reference);
        if (!isActive) return;

        const normalizedStatus =
          result?.status || result?.data?.status || "succeeded";
        setPaymentStatus(normalizedStatus);
        setVerificationStatus("success");
      } catch {
        if (!isActive) return;
        setPaymentStatus("pending");
        setVerificationStatus("error");
      }
    };

    verify();

    return () => {
      isActive = false;
    };
  }, [reference, shouldVerify]);

  const isCancelled = status === "cancelled";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t("orderConfirmation.title")}</h1>

      <div className="mt-4 rounded-md border p-4">
        {isCancelled ? (
          <p className="text-sm text-destructive">
            {t("orderConfirmation.cancelled")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("orderConfirmation.summary", {
                orderId: orderId || t("common.notAvailable"),
                processor: processor || t("common.notAvailable"),
              })}
            </p>

            {verificationStatus === "loading" && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("orderConfirmation.verifying")}
              </p>
            )}

            {(verificationStatus === "success" ||
              verificationStatus === "error") && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("orderConfirmation.paymentStatus", {
                  status: paymentStatus || t("common.pending"),
                })}
              </p>
            )}

            {!shouldVerify && !isCancelled && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("orderConfirmation.successFallback")}
              </p>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {orderId && (
            <Link to={`/account/orders/${orderId}`} className="btn-primary">
              {t("orderConfirmation.viewOrder")}
            </Link>
          )}
          <Link
            to="/account/orders"
            className="rounded-md border px-4 py-2 text-sm"
          >
            {t("orderConfirmation.backToOrders")}
          </Link>
          <Link to="/checkout" className="rounded-md border px-4 py-2 text-sm">
            {t("orderConfirmation.backToCheckout")}
          </Link>
        </div>
      </div>
    </div>
  );
}
