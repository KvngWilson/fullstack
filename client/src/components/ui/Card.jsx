import React from 'react';
import { cva } from 'class-variance-authority';

const cardVariants = cva(
  "overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/80 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.25)] backdrop-blur-lg transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white/80 border-white/60",
        elevated:
          "bg-white/90 border-white/70 hover:-translate-y-1 hover:shadow-[0_30px_90px_-42px_rgba(15,23,42,0.38)]",
        outline: "border border-slate-200/80 bg-white/72 shadow-none",
        ghost: "border-transparent bg-transparent shadow-none backdrop-blur-none",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-5",
        lg: "p-7",
        xl: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  },
);

export const Card = React.forwardRef(
  ({ variant = "default", padding = "md", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({ variant, padding, className })}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mb-4 border-b border-slate-100 pb-4 ${className || ""}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={`text-xl font-semibold tracking-tight text-slate-900 ${className || ""}`}
        {...props}
      >
        {children}
      </h2>
    );
  }
);

CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`mt-1 text-sm text-slate-500 ${className || ""}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${className || ""}`} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 flex gap-2 border-t border-slate-100 pt-4 ${className || ""}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = "CardFooter";

const alertVariants = cva(
  "rounded-[1.35rem] border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-sky-100 bg-sky-50/90 text-sky-900",
        success: "border-emerald-100 bg-emerald-50/90 text-emerald-900",
        warning: "border-amber-100 bg-amber-50/90 text-amber-900",
        error: "border-red-100 bg-red-50/90 text-red-900",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export const Alert = React.forwardRef(
  ({ variant = "info", className, children, title, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={alertVariants({ variant, className })}
        role="alert"
        {...props}
      >
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {children}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export default Card;
