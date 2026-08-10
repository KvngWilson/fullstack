import React from 'react';
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold tracking-tight shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#38bdf8_100%)] text-white hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-26px_rgba(29,78,216,0.7)] focus-visible:ring-sky-400",
        secondary:
          "border border-slate-200/80 bg-white/90 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:bg-white focus-visible:ring-slate-300",
        success:
          "bg-[linear-gradient(135deg,#166534,#22c55e)] text-white hover:-translate-y-0.5 focus-visible:ring-green-400",
        warning:
          "bg-[linear-gradient(135deg,#b45309,#f59e0b)] text-white hover:-translate-y-0.5 focus-visible:ring-amber-300",
        error:
          "bg-[linear-gradient(135deg,#b91c1c,#ef4444)] text-white hover:-translate-y-0.5 focus-visible:ring-red-300",
        ghost:
          "border border-slate-200/70 bg-white/70 text-slate-700 shadow-none backdrop-blur-md hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white focus-visible:ring-slate-300",
        outline:
          "border border-slate-200/80 bg-transparent text-slate-700 shadow-none hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/70 focus-visible:ring-sky-300",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
      },
      state: {
        default: "",
        loading: "cursor-wait opacity-70",
        disabled: "cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      state: "default",
    },
  },
);

export const Button = React.forwardRef(
  (
    {
      variant = "primary",
      size = "md",
      state = "default",
      disabled = false,
      loading = false,
      className,
      children,
      ...props
    },
     ref,
  ) => {
   const resolvedState = disabled ? "disabled" : loading ? "loading" : state;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonVariants({ variant, size, state: resolvedState, className })}
        aria-busy={loading}
        aria-disabled={disabled}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
