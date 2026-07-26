import React from "react";

/**
 * UI Badge component for status or labels.
 * Uses Tailwind and design tokens.
 */
export function Badge({
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  const variants = {
    primary:
      "border border-slate-900/5 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_65%,#38bdf8_100%)] text-white shadow-[0_16px_35px_-24px_rgba(29,78,216,0.75)]",
    secondary:
      "border border-slate-200/80 bg-white/85 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    accent: "border border-violet-100 bg-violet-50 text-violet-700",
    success: "border border-emerald-100 bg-emerald-50 text-emerald-700",
    error: "border border-red-100 bg-red-50 text-red-700",
    muted: "border border-slate-200/80 bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
