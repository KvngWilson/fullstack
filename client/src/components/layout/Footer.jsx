import { createElement } from "react";
import { Link } from "react-router-dom";
import { Mail, RefreshCw, ShieldCheck, Truck } from "lucide-react";

const footerColumns = [
  {
    heading: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Careers", to: "/careers" },
      { label: "Press", to: "/press" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help Center", to: "/contact" },
      { label: "Shipping", to: "/shipping" },
      { label: "Returns", to: "/returns" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Products", to: "/products" },
      { label: "Fashion", to: "/category/fashion" },
      { label: "Accessories", to: "/category/accessories" },
    ],
  },
];

const trustSignals = [
  { icon: Truck, label: "Fast fulfillment" },
  { icon: ShieldCheck, label: "Secure payments" },
  { icon: RefreshCw, label: "Easy returns" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/70 bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_28%)]"
      />

      <div className="landing-container relative py-16">
        <div className="rounded-section border border-white/12 bg-white/10 p-8 shadow-[0_26px_80px_-48px_rgba(15,23,42,0.75)] backdrop-blur-xl lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="tag-soft bg-white/10 text-sky-200">Stay in the loop</span>
              <h3 className="mt-4 font-heading text-3xl font-bold tracking-tight text-white">
                Weekly drops, insider pricing, and hand-picked inspiration.
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Join the Dealport list and get 15% off your first order plus early access
                to the newest collections.
              </p>
            </div>

            <div className="w-full max-w-lg space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-3 text-slate-200">
                  <Mail className="h-4 w-4 text-sky-300" />
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    placeholder="Enter your email"
                  />
                </div>
                <button className="btn-primary min-w-[9.5rem]" type="button">
                  Subscribe
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {trustSignals.map(({ icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300"
                  >
                    {createElement(icon, { className: "h-3.5 w-3.5 text-sky-300" })}
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)] font-heading text-lg font-bold text-white shadow-[0_18px_36px_-24px_rgba(56,189,248,0.85)]">
                D
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold tracking-tight">Dealport</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Modern marketplace
                </p>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-6 text-slate-300">
              Discover premium-looking everyday essentials, trending gifts, and curated
              collections across fashion, beauty, and home.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading} className="space-y-4">
              <h4 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">
                {column.heading}
              </h4>
              <ul className="space-y-3 text-sm text-slate-400">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="hover:text-white" to={link.to}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Dealport. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link className="hover:text-white" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-white" to="/terms">
              Terms
            </Link>
            <Link className="hover:text-white" to="/cookies">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
