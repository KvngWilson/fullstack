import { Link } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { selectIsAuthenticated, selectUser } from '@/features/auth/authSelectors';
import { selectCartItemCount } from '@/features/cart/cartSelectors';
import { selectWishlistCount } from '@/features/wishlist/wishlistSelectors';
import { ShoppingCart, User, Menu, Search, Heart, ChevronDown } from 'lucide-react';

export default function Header() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const cartItemCount = useAppSelector(selectCartItemCount);
  const wishlistCount = useAppSelector(selectWishlistCount);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur">
      <div className="border-b bg-slate-900 text-white">
        <div className="landing-container flex h-10 items-center justify-between text-xs">
          <p>Free delivery on orders over $250.00</p>
          <div className="flex items-center gap-4">
            <span>English</span>
            <span>USD</span>
            <span>Support</span>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="landing-container flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button className="rounded-full border border-border p-2 lg:hidden">
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
                placeholder="What are you looking for?"
              />
            </div>
            <button className="btn-primary hidden lg:inline-flex">Search</button>
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
            <Link to="/cart" className="relative rounded-full border border-border p-2">
              <ShoppingCart className="h-4 w-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
                <User className="h-4 w-4" />
                <span>{user?.first_name || 'Account'}</span>
              </div>
            ) : (
              <Link to="/login" className="btn-primary">Sign In</Link>
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
              Shop
            </Link>
            <Link to="/category/grocery" className="text-muted-foreground hover:text-foreground">
              Grocery
            </Link>
            <Link to="/category/fashion" className="text-muted-foreground hover:text-foreground">
              Fashion
            </Link>
            <Link to="/category/electronics" className="text-muted-foreground hover:text-foreground">
              Electronics
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
