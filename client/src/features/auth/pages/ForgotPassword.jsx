import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/api/authService";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-2">
          {t("auth.forgotPassword.title")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {t("auth.forgotPassword.subtitle")}
        </p>

        {error && (
          <ErrorState
            className="mb-4"
            title={t("auth.forgotPassword.failedTitle")}
            message={error}
            onRetry={() => setError("")}
          />
        )}

        {success ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {t("auth.forgotPassword.successMessage")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("auth.fields.email")}
              </label>
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.fields.emailPlaceholder")}
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

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-blue-500 hover:underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
