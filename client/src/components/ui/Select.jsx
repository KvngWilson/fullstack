import React from "react";

/**
 * UI Select component with accessible labeling and states.
 * Uses Tailwind and design tokens.
 */
export const Select = React.forwardRef(function Select({
  className = "",
  disabled = false,
  children,
  ...props
}, ref) {
  return (
    <select
      ref={ref}
      className={`block w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-sm focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 ${className}`}
      disabled={disabled}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </select>
  );
});
