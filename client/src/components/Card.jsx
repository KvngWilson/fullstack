import React from 'react';
import { cva } from 'class-variance-authority';

/**
 * Card CVA component
 * Container component with shadow and border options
 */
const cardVariants = cva(
  'rounded-lg overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-white border border-neutral-200 shadow-sm',
        elevated: 'bg-white shadow-md hover:shadow-lg transition-shadow',
        outline: 'bg-white border-2 border-neutral-200',
        ghost: 'bg-transparent',
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

/**
 * Card component
 */
export const Card = React.forwardRef(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
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

Card.displayName = 'Card';

/**
 * Card subcomponents
 */
export const CardHeader = ({ className, children, ...props }) => (
  <div className={`border-b border-neutral-200 pb-4 mb-4 ${className || ''}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }) => (
  <h2 className={`text-xl font-semibold text-neutral-900 ${className || ''}`} {...props}>
    {children}
  </h2>
);

export const CardDescription = ({ className, children, ...props }) => (
  <p className={`text-sm text-neutral-500 mt-1 ${className || ''}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className, children, ...props }) => (
  <div className={`${className || ''}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }) => (
  <div className={`border-t border-neutral-200 pt-4 mt-4 flex gap-2 ${className || ''}`} {...props}>
    {children}
  </div>
);

/**
 * Badge CVA component
 * Small label component
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium text-xs px-2.5 py-0.5',
  {
    variants: {
      variant: {
        primary: 'bg-blue-100 text-blue-800',
        secondary: 'bg-neutral-100 text-neutral-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        error: 'bg-red-100 text-red-800',
        outline: 'border border-neutral-300 text-neutral-700',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

/**
 * Badge component
 */
export const Badge = React.forwardRef(
  ({ variant = 'primary', className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={badgeVariants({ variant, className })}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

/**
 * Alert CVA component
 * Status message component
 */
const alertVariants = cva(
  'rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        info: 'border-blue-200 bg-blue-50 text-blue-800',
        success: 'border-green-200 bg-green-50 text-green-800',
        warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
        error: 'border-red-200 bg-red-50 text-red-800',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

/**
 * Alert component
 */
export const Alert = React.forwardRef(
  ({ variant = 'info', className, children, title, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={alertVariants({ variant, className })}
        role="alert"
        {...props}
      >
        {title && <p className="font-semibold mb-1">{title}</p>}
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Card;
