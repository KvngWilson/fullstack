import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui";

const accountLinks = [
  { label: "Overview", to: "/dashboard" },
  { label: "Profile", to: "/account/profile" },
  { label: "Orders", to: "/account/orders" },
  { label: "Wishlist", to: "/account/wishlist" },
  { label: "Addresses", to: "/account/addresses" },
  { label: "Saved Cards", to: "/account/saved-cards" },
];

export default function AccountHeader({
  eyebrow = "Customer account",
  title,
  description,
  badge,
  stats = [],
  actions,
}) {
  return (
    <div className="rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {badge ? <Badge className="mb-4" variant="secondary">{badge}</Badge> : null}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      {stats.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-card border border-slate-100 bg-slate-50/90 px-5 py-4"
            >
              <p className="font-heading text-2xl font-bold tracking-tight text-slate-950">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2">
        {accountLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive
                ? "pill pill-active"
                : "pill"
            }
            end={link.to === "/dashboard"}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
