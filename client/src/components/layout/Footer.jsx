import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t">
      <div className="landing-container py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-border">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Join our newsletter</h3>
              <p className="text-sm text-muted-foreground">Get 15% off your first order.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-full border border-border px-4 py-2 text-sm"
                placeholder="Enter your email"
              />
              <button className="btn-primary">Subscribe</button>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-5">
          <div className="space-y-3 md:col-span-2">
            <h3 className="text-lg font-semibold">DEALPORT</h3>
            <p className="text-sm text-muted-foreground">
              Everything you need for fashion, electronics, and home essentials in one place.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about">About</Link></li>
              <li><Link to="/careers">Careers</Link></li>
              <li><Link to="/press">Press</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact">Help Center</Link></li>
              <li><Link to="/shipping">Shipping</Link></li>
              <li><Link to="/returns">Returns</Link></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/products">Shop</Link></li>
              <li><Link to="/category/fashion">Fashion</Link></li>
              <li><Link to="/category/electronics">Electronics</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-xs text-muted-foreground flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Dealport. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/cookies">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
