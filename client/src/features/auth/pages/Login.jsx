import { useEffect, useReducer, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { loginThunk } from "@/features/auth/authThunks";
import {
  selectAuthIsLoading,
  selectAuthError,
  selectAuthUser,
} from "@/features/auth/authSelectors";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/common/AsyncState";

export default function Login() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const isLoading = useAppSelector(selectAuthIsLoading);
  const error = useAppSelector(selectAuthError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useReducer(
    (state, action) => ({ ...state, ...action }),
    { email: "", password: "", localError: "" },
  );

  useEffect(() => {
    if (user?.id) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setFormData({ localError: t("auth.login.errors.requiredFields") });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormData({ localError: t("auth.login.errors.invalidEmail") });
      return;
    }

    setFormData({ localError: "" });
    setIsSubmitting(true);
    try {
      const [result] = await Promise.all([
        dispatch(
          loginThunk({ email: formData.email, password: formData.password }),
        ),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);

      if (result.meta.requestStatus === "fulfilled") {
        navigate("/dashboard");
        return;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-2">{t("auth.login.title")}</h1>
          <p className="text-muted-foreground mb-6">
            {t("auth.login.subtitle")}
          </p>

          {(error || formData.localError) && (
            <ErrorState
              className="mb-6"
              title={t("auth.login.failedTitle")}
              message={formData.localError || error}
              onRetry={() =>
                setFormData({ email: "", password: "", localError: "" })
              }
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("auth.fields.email")}
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={t("auth.fields.emailPlaceholder")}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t("auth.fields.password")}
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t("auth.fields.passwordPlaceholder")}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting
                ? t("auth.login.loading")
                : t("auth.login.submit")}
            </Button>
          </form>

          <div className="mt-3 text-right text-sm">
            <Link
              to="/forgot-password"
              className="text-blue-500 hover:underline"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>

          <div className="mt-4 text-center text-sm">
            <p className="text-muted-foreground">
              {t("auth.login.noAccount")}{" "}
              <Link to="/register" className="text-blue-500 hover:underline">
                {t("auth.login.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
