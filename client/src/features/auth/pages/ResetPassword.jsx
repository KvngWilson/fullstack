import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge, Card } from "@/components/ui";

export default function ResetPassword() {
  const { t } = useTranslation();

  return (
    <div className="landing-container section-wrap">
      <div className="mx-auto max-w-2xl rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <Badge variant="secondary">Reset password</Badge>
        <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-slate-950">
          {t("auth.resetPassword.title")}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          This screen is ready for the reset form flow and now matches the updated visual
          direction across the customer experience.
        </p>

        <Card variant="outline" className="mt-6">
          <p className="text-sm text-slate-500">
            Add the password reset form here when the token-based reset flow is wired.
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Back to login
          </Link>
        </Card>
      </div>
    </div>
  );
}
