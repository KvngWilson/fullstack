import { useEffect, useReducer } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck, Sparkles, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { registerThunk } from "@/features/auth/authThunks";
import {
  selectAuthError,
  selectAuthIsLoading,
  selectAuthUser,
} from "@/features/auth/authSelectors";
import { getPostLoginPath } from "@/features/auth/getPostLoginPath";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/common/AsyncState";

const onboardingBenefits = [
  "Save favorite products and curated picks",
  "Track orders from checkout to delivery",
  "Enjoy a faster, more polished shopping flow",
];

export default function Register() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const isLoading = useAppSelector(selectAuthIsLoading);
  const error = useAppSelector(selectAuthError);

  const [formData, setFormData] = useReducer(
    (state, action) => ({ ...state, ...action }),
    {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      subscribeNewsletter: false,
      localError: "",
    },
  );

  useEffect(() => {
    if (user?.id) {
      navigate(getPostLoginPath(user.role));
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setFormData({ localError: t("auth.register.errors.requiredFields") });
      return;
    }

    if (!formData.acceptTerms) {
      setFormData({ localError: "You must accept the terms and conditions." });
      return;
    }

    if (formData.password.length < 8) {
      setFormData({ localError: t("auth.register.errors.passwordMinLength") });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormData({ localError: t("auth.register.errors.passwordMismatch") });
      return;
    }

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      confirm_password: formData.confirmPassword,
      accept_terms: formData.acceptTerms,
      subscribe_newsletter: formData.subscribeNewsletter,
    };

    setFormData({ localError: "" });
    const result = await dispatch(registerThunk(payload));
    if (result.meta.requestStatus === "fulfilled") {
      navigate(getPostLoginPath(result.payload?.user?.role));
      return;
    }

    const isDuplicateEmailCase =
      result?.payload?.error?.includes?.("duplicate") ||
      result?.error?.message?.toLowerCase?.().includes?.("duplicate") ||
      (error && error.toLowerCase().includes("duplicate"));

    if (isDuplicateEmailCase) {
      setFormData({ localError: t("auth.register.errors.duplicateEmail") });
    }
  };

  return (
    <div className="landing-container section-wrap">
      <div className="grid overflow-hidden rounded-section border border-white/70 bg-white/80 shadow-[0_34px_110px_-56px_rgba(15,23,42,0.34)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_520px]">
        <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:block">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.22),transparent_32%)]"
          />
          <img
            src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80"
            alt="Modern shopping setup"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="relative z-10 flex h-full max-w-md flex-col justify-between">
            <div>
              <span className="tag-soft bg-white/10 text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Create an account
              </span>
              <h1 className="mt-6 font-heading text-5xl font-bold leading-[0.95] tracking-tight">
                Build a smoother, more personalized shopping experience.
              </h1>
              <p className="mt-5 text-sm leading-7 text-slate-200">
                Join Dealport to keep your dashboard, saved items, and checkout
                history in a clean, modern workspace.
              </p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/10 p-6 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                With an account
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                {onboardingBenefits.map((item) => (
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
                    New account
                  </p>
                </div>
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-950">
                {t("auth.register.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {t("auth.register.subtitle")}
              </p>
            </div>

            {(error || formData.localError) && (
              <ErrorState
                className="mb-6"
                title={t("auth.register.failedTitle")}
                message={formData.localError || error}
                onRetry={() =>
                  setFormData({
                    firstName: "",
                    lastName: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
                    acceptTerms: false,
                    subscribeNewsletter: false,
                    localError: "",
                  })
                }
              />
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    First Name
                  </label>
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      required
                      className="pl-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Last Name
                  </label>
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      required
                      className="pl-11"
                    />
                  </div>
                </div>
              </div>

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
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("auth.fields.passwordLabel")}
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    name="password"
                    id="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t("auth.fields.passwordPlaceholderText")}
                    required
                    className="pl-11"
                  />
                </div>
                {formData.password && formData.password.length < 8 && (
                  <p className="mt-2 text-xs text-red-500">
                    {t("auth.register.errors.passwordMinLength")}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("auth.fields.confirmPassword")}
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={t("auth.fields.passwordPlaceholderText")}
                    required
                    className="pl-11"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                  />
                  <span>
                    I accept the Terms and Conditions and Privacy Policy.
                  </span>
                </label>

                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="subscribeNewsletter"
                    checked={formData.subscribeNewsletter}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                  />
                  <span>Send me product updates and offers (optional).</span>
                </label>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading
                  ? t("auth.register.loading")
                  : t("auth.register.submit")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {t("auth.register.hasAccount")}{" "}
              <Link
                to="/login"
                className="font-semibold text-sky-600 hover:text-sky-700"
              >
                {t("auth.login.submit")}
              </Link>
            </div>

            <div className="mt-3 text-center text-sm text-slate-500">
              Looking to open a store?{" "}
              <Link
                to="/vendor/apply"
                className="font-semibold text-sky-600 hover:text-sky-700"
              >
                Start a vendor application
              </Link>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              Secure account setup powered by Dealport.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
