import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectIsAuthenticated, selectUser } from '@/features/auth/authSelectors';
import { logoutThunk } from '@/features/auth/authThunks';
import { selectCartItemCount } from '@/features/cart/cartSelectors';
import { selectWishlistCount } from '@/features/wishlist/wishlistSelectors';
import { ShoppingCart, User, Menu, Search, Heart, ChevronDown } from 'lucide-react';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

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
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur">
      <div className="border-b bg-slate-900 text-white">
        <div className="landing-container flex h-10 items-center justify-between text-xs">
          <p>{t('header.freeDelivery', { amount: formatCurrency(250) })}</p>
          <div className="flex items-center gap-4">
            <label className="sr-only" htmlFor="language-selector">Language</label>
            <select
              id="language-selector"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded border border-white/30 bg-slate-800 px-2 py-1 text-[11px] text-white"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="currency-selector">Currency</label>
            <select
              id="currency-selector"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="rounded border border-white/30 bg-slate-800 px-2 py-1 text-[11px] text-white"
            >
              {supportedCurrencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
            <span>{t('header.support')}</span>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="landing-container flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button aria-label="menu" className="menu-button rounded-full border border-border p-2 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
              <span className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">DEAL</span>
              <span>PORT</span>
            </Link>
          </div>

          <div className="flex flex-1 items-center gap-3 lg:max-w-xl">
            <div className="flex flex-1 items-center rounded-full border border-border bg-white px-4 py-2">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <input
                className="flex-1 text-sm outline-none"
                placeholder={t('header.searchPlaceholder')}
              />
            </div>
            <button className="btn-primary hidden lg:inline-flex">{t('header.search')}</button>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/account/wishlist" className="relative rounded-full border border-border p-2">
              <Heart className="h-4 w-4" />
              {wishlistCount > 0 && (
                <span className="absolute -top-2 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link to="/cart" className="relative inline-flex items-center gap-2 rounded-full border border-border px-3 py-2">
              <span className="cart sr-only">{cartItemCount}</span>
              <ShoppingCart className="h-4 w-4" />
              <span aria-label="cart-count" className="cart-count text-xs font-semibold">{cartItemCount}</span>
              <span className="text-sm">{t('header.cart')}</span>
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
                <User className="h-4 w-4" />
                <Link to="/dashboard" className="hover:underline">{user?.first_name || 'Account'}</Link>
                <button
                  type="button"
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    dispatch(logoutThunk());
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary ">Sign In</Link>
            )}
          </div>
        </div>
      </div>

      <div className="border-b bg-white">
        <div className="landing-container flex items-center gap-6 py-3 text-sm font-medium">
          <button className="flex items-center gap-2 rounded-full border border-border px-4 py-2">
            <span>Browse</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <nav className="hidden flex-1 items-center gap-6 lg:flex">
            <Link to="/products" className="text-muted-foreground hover:text-foreground">
              Products
            </Link>
            <Link to="/category/hats" className="text-muted-foreground hover:text-foreground">
              Hats
            </Link>
            <Link to="/category/fashion" className="text-muted-foreground hover:text-foreground">
              Fashion
            </Link>
            <Link to="/category/jewelry" className="text-muted-foreground hover:text-foreground">
              Jewelry
            </Link>
            <Link to="/category/accessories" className="text-muted-foreground hover:text-foreground">
              Accessories
            </Link>
            <Link to="/category/beauty" className="text-muted-foreground hover:text-foreground">
              Beauty
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
