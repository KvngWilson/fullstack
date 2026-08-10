import { createElement } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  User,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectIsAuthenticated, selectUser } from "@/features/auth/authSelectors";
import { logoutThunk } from "@/features/auth/authThunks";
import { selectCartItemCount } from "@/features/cart/cartSelectors";
import { selectWishlistCount } from "@/features/wishlist/wishlistSelectors";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

const quickLinks = [
  { label: "Products", to: "/products" },
  { label: "Hats", to: "/category/hats" },
  { label: "Fashion", to: "/category/fashion" },
  { label: "Jewelry", to: "/category/jewelry" },
  { label: "Accessories", to: "/category/accessories" },
  { label: "Beauty", to: "/category/beauty" },
];

const highlightPills = [
  { icon: Sparkles, label: "Fresh drops daily" },
  { icon: ShieldCheck, label: "Protected checkout" },
];

export default function Header() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const cartItemCount = useAppSelector(selectCartItemCount);
  const wishlistCount = useAppSelector(selectWishlistCount);
  const {
    language,
    setLanguage,
    supportedLanguages,
    currency,
    setCurrency,
    supportedCurrencies,
    t,
    formatCurrency,
  } = useAppPreferences();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="border-b border-slate-900/10 bg-slate-950 text-white">
        <div className="landing-container flex min-h-10 flex-wrap items-center justify-between gap-2 py-2 text-xs">
          <p className="font-medium tracking-[0.08em] text-slate-200 uppercase">
            {t("header.freeDelivery", { amount: formatCurrency(250) })}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <label className="sr-only" htmlFor="language-selector">
              Language
            </label>
            <select
              id="language-selector"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white outline-none"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="currency-selector">
              Currency
            </label>
            <select
              id="currency-selector"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white outline-none"
            >
              {supportedCurrencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
            <span className="hidden md:inline-flex">24/7 style support</span>
          </div>
        </div>
      </div>

      <div className="border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="landing-container py-4">
          <div className="rounded-section border border-white/70 bg-white/80 px-4 py-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.34)] backdrop-blur-xl lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button
                  aria-label="menu"
                  className="menu-button rounded-full border border-slate-200/70 p-3 lg:hidden"
                  type="button"
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>

                <Link to="/" className="group flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_65%,#38bdf8_100%)] text-lg font-bold text-white shadow-[0_18px_36px_-22px_rgba(29,78,216,0.82)]">
                    D
                  </span>
                  <div>
                    <p className="font-heading text-lg font-bold tracking-tight text-slate-950">
                      Dealport
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Curated marketplace
                    </p>
                  </div>
                </Link>
              </div>

              <div className="flex flex-1 flex-col gap-3 xl:mx-6 xl:max-w-3xl">
                <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/92 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder={t("header.searchPlaceholder")}
                  />
                  <button className="btn-primary hidden min-w-[7rem] lg:inline-flex" type="button">
                    {t("header.search")}
                  </button>
                </div>

                <div className="hidden flex-wrap items-center gap-2 lg:flex">
                  {highlightPills.map(({ icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/85 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      {createElement(icon, { className: "h-3.5 w-3.5 text-sky-500" })}
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/account/wishlist"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm"
                >
                  <Heart className="h-4 w-4" />
                  {wishlistCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] font-bold text-white">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/cart"
                  className="relative inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  <span className="sr-only">{cartItemCount}</span>
                  <ShoppingCart className="h-4 w-4" />
                  <span aria-label="cart-count" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {cartItemCount}
                  </span>
                  <span>{t("header.cart")}</span>
                </Link>

                {isAuthenticated ? (
                  <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white">
                      <User className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        to="/dashboard"
                        className="truncate text-sm font-semibold text-slate-900 hover:text-sky-600"
                      >
                        {user?.first_name || "Account"}
                      </Link>
                      <button
                        type="button"
                        className="text-left text-xs font-medium text-slate-500 hover:text-slate-900"
                        onClick={() => {
                          dispatch(logoutThunk());
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link to="/login" className="btn-primary min-w-[7.5rem]">
                    Sign In
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-semibold text-slate-700"
                  type="button"
                >
                  <span>Browse</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <nav className="hidden flex-wrap items-center gap-2 lg:flex">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="hidden items-center gap-2 xl:flex">
                <span className="tag-soft">New drop</span>
                <p className="text-sm font-medium text-slate-500">
                  Sleek picks across fashion, beauty, home, and tech.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
