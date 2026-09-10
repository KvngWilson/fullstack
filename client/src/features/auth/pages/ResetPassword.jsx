import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/authService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/common/AsyncState";
import { getErrorMessage } from "@/utils/getErrorMessage";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasToken = token.trim().length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!hasToken) {
      setError(t("auth.resetPassword.errors.missingToken"));
      return;
    }

    if (!password || !confirmPassword) {
      setError(t("auth.resetPassword.errors.requiredFields"));
      return;
    }

    if (password.length < 8) {
      setError(t("auth.resetPassword.errors.passwordMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.resetPassword.errors.passwordMismatch"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (submissionError) {
      setError(
        getErrorMessage(
          submissionError,
          t("auth.resetPassword.errors.submitFailed"),
        ),
      );
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
          {t("auth.resetPassword.title")}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-500">
          {t("auth.resetPassword.subtitle")}
        </p>

        {error && (
          <ErrorState
            className="mt-6"
            title={t("auth.resetPassword.failedTitle")}
            message={error}
            onRetry={() => setError("")}
          />
        )}

        {success ? (
          <div className="mt-6 rounded-section border border-emerald-100 bg-emerald-50/90 p-5 text-sm text-emerald-900">
            {t("auth.resetPassword.successMessage")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("auth.fields.passwordPlaceholderText")}
                className="pl-11"
                required
              />
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("auth.fields.confirmPassword")}
                className="pl-11"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !hasToken}
            >
              {isLoading
                ? t("auth.resetPassword.loading")
                : t("auth.resetPassword.submit")}
            </Button>
          </form>
        )}

        {!hasToken && !success && (
          <p className="mt-4 text-sm text-amber-700">
            {t("auth.resetPassword.errors.missingToken")}
          </p>
        )}

        {success && (
          <Button
            type="button"
            className="mt-6 w-full"
            onClick={() => navigate("/login")}
          >
            {t("auth.resetPassword.backToLogin")}
          </Button>
        )}

        {!success && (
          <div className="mt-6 text-center text-sm">
            <Link
              to="/login"
              className="font-semibold text-sky-600 hover:text-sky-700"
            >
              {t("auth.resetPassword.backToLogin")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
