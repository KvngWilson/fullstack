import React from 'react';
import { cva } from 'class-variance-authority';

const inputVariants = cva(
  "flex w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-sm placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
  {
    variants: {
      variant: {
        default: "border-slate-200/80",
        error: "border-red-400 focus:border-red-300 focus:ring-red-100",
        success: "border-emerald-400 focus:border-emerald-300 focus:ring-emerald-100",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export const Input = React.forwardRef(
  (
    { variant = "default", size = "md", type = "text", className, ...props },
    ref,
  ) => {
    return (
      <input
        ref={ref}
        type={type}
        className={inputVariants({ variant, size, className })}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

const textareaVariants = cva(
  "flex w-full resize-none rounded-[1.35rem] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-sm placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-100",
  {
    variants: {
      variant: {
        default: "border-slate-200/80",
        error: "border-red-400 focus:border-red-300 focus:ring-red-100",
        success: "border-emerald-400 focus:border-emerald-300 focus:ring-emerald-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const Textarea = React.forwardRef(
  ({ variant = "default", className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={textareaVariants({ variant, className })}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export const FormField = React.forwardRef(
  (
    {
      label,
      error,
      required,
      hint,
      children,
      className,
    },
    ref
  ) => {
    return (
      <div className={`flex flex-col gap-1 ${className || ""}`} ref={ref}>
        {label && (
          <label className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        {children}

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="text-sm text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

export default Input;
