import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/authService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/common/AsyncState";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError(t("auth.forgotPassword.errors.requiredEmail"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authService.requestPasswordReset(email);
      setSuccess(true);
    } catch {
      setSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-container section-wrap">
      <div className="mx-auto max-w-2xl rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Password recovery
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950">
          {t("auth.forgotPassword.title")}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          {t("auth.forgotPassword.subtitle")}
        </p>

        {error && (
          <ErrorState
            className="mt-6"
            title={t("auth.forgotPassword.failedTitle")}
            message={error}
            onRetry={() => setError("")}
          />
        )}

        {success ? (
          <div className="mt-6 rounded-section border border-emerald-100 bg-emerald-50/90 p-5 text-sm text-emerald-900">
            {t("auth.forgotPassword.successMessage")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.fields.emailPlaceholder")}
                className="pl-11"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? t("auth.forgotPassword.loading")
                : t("auth.forgotPassword.submit")}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="font-semibold text-sky-600 hover:text-sky-700"
          >
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
