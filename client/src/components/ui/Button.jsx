import React from 'react';
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
        secondary:
          'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 focus-visible:ring-neutral-500',
        success:
          'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
        warning:
          'bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-yellow-500',
        error:
          'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        ghost:
          'text-neutral-700 hover:bg-neutral-100 focus-visible:ring-neutral-500',
        outline:
          'border border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus-visible:ring-neutral-500',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-base',
        xl: 'h-12 px-8 text-lg',
      },
      state: {
        default: '',
        loading: 'opacity-70 cursor-wait',
        disabled: 'opacity-50 cursor-not-allowed',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      state: 'default',
    },
  }
);

export const Button = React.forwardRef(
  (
    {
      variant = 'primary',
      size = 'md',
      state = 'default',
      disabled = false,
      loading = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const resolvedState = disabled ? 'disabled' : loading ? 'loading' : state;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonVariants({
          variant,
          size,
          state: resolvedState,
          className,
        })}
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

Button.displayName = 'Button';

export default Button;
