import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { paymentsService } from "@/services/paymentService";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";
import { Badge, Card } from "@/components/ui";

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
    <div className="landing-container section-wrap">
      <div className="rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <Badge variant={isCancelled ? "error" : "success"}>
          {isCancelled ? "Payment cancelled" : "Order update"}
        </Badge>
        <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {t("orderConfirmation.title")}
        </h1>
      </div>

      <Card className="mt-8">
        {isCancelled ? (
          <p className="text-sm text-red-600">
            {t("orderConfirmation.cancelled")}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-500">
              {t("orderConfirmation.summary", {
                orderId: orderId || t("common.notAvailable"),
                processor: processor || t("common.notAvailable"),
              })}
            </p>

            {verificationStatus === "loading" && (
              <p className="mt-4 text-sm text-slate-500">
                {t("orderConfirmation.verifying")}
              </p>
            )}

            {(verificationStatus === "success" ||
              verificationStatus === "error") && (
              <p className="mt-4 text-sm text-slate-500">
                {t("orderConfirmation.paymentStatus", {
                  status: paymentStatus || t("common.pending"),
                })}
              </p>
            )}

            {!shouldVerify && !isCancelled && (
              <p className="mt-4 text-sm text-slate-500">
                {t("orderConfirmation.successFallback")}
              </p>
            )}
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {orderId && (
            <Link to={`/account/orders/${orderId}`} className="btn-primary">
              {t("orderConfirmation.viewOrder")}
            </Link>
          )}
          <Link to="/account/orders" className="btn-ghost">
            {t("orderConfirmation.backToOrders")}
          </Link>
          <Link to="/checkout" className="btn-ghost">
            {t("orderConfirmation.backToCheckout")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
