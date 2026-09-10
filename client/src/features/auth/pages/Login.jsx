import { useEffect, useReducer, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { loginThunk } from "@/features/auth/authThunks";
import {
  selectAuthError,
  selectAuthIsLoading,
  selectAuthUser,
} from "@/features/auth/authSelectors";
import { getPostLoginPath } from "@/features/auth/getPostLoginPath";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/common/AsyncState";

const benefits = [
  "Personalized dashboard access",
  "Faster checkout with stored details",
  "Live updates for orders and wishlists",
];

export default function Login() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      navigate(getPostLoginPath(user.role));
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
        navigate(getPostLoginPath(result.payload?.user?.role));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showExpiredMessage = searchParams.get("expired") === "true";
  const showInvitationAcceptedMessage =
    searchParams.get("invitationAccepted") === "true";

  return (
    <div className="landing-container section-wrap">
      <div className="grid overflow-hidden rounded-section border border-white/70 bg-white/80 shadow-[0_34px_110px_-56px_rgba(15,23,42,0.34)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:block">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.26),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.2),transparent_32%)]"
          />
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80"
            alt="Shopping lifestyle"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="relative z-10 flex h-full max-w-md flex-col justify-between">
            <div>
              <span className="tag-soft bg-white/10 text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Welcome back
              </span>
              <h1 className="mt-6 font-heading text-5xl font-bold leading-[0.95] tracking-tight">
                Sign in to continue your curated shopping experience.
              </h1>
              <p className="mt-5 text-sm leading-7 text-slate-200">
                Access your saved items, orders, and a cleaner account space
                designed to feel modern and effortless.
              </p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/10 p-6 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                Why shoppers log in
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                {benefits.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                      <ShieldCheck className="h-4 w-4 text-sky-200" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <Link to="/" className="inline-flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_65%,#38bdf8_100%)] font-heading text-lg font-bold text-white shadow-[0_18px_36px_-22px_rgba(29,78,216,0.82)]">
                  D
                </span>
                <div>
                  <p className="font-heading text-lg font-bold tracking-tight text-slate-950">
                    Dealport
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Account access
                  </p>
                </div>
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-950">
                {t("auth.login.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {t("auth.login.subtitle")}
              </p>
            </div>

            {showExpiredMessage && (
              <div className="mb-6 rounded-card border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                Your session expired. Please sign in again to continue.
              </div>
            )}
            {showInvitationAcceptedMessage && (
              <div className="mb-6 rounded-card border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
                Your employee invitation has been accepted. Sign in to continue.
              </div>
            )}

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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("auth.fields.email")}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    required
                    className="pl-11"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t("auth.fields.passwordLabel")}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-sky-600 hover:text-sky-700"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t("auth.fields.passwordPlaceholderText")}
                    required
                    className="pl-11"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full"
                size="lg"
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting
                  ? t("auth.login.loading")
                  : t("auth.login.submit")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {t("auth.login.noAccount")}{" "}
              <Link
                to="/register"
                className="font-semibold text-sky-600 hover:text-sky-700"
              >
                {t("auth.login.signUp")}
              </Link>
            </div>

            <div className="mt-3 text-center text-sm text-slate-500">
              Want to sell on Dealport?{" "}
              <Link
                to="/vendor/apply"
                className="font-semibold text-sky-600 hover:text-sky-700"
              >
                Apply as a vendor
              </Link>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              Secure login experience powered by Dealport.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
