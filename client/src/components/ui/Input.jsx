import React from 'react';
import { cva } from 'class-variance-authority';

const inputVariants = cva(
  'flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-transparent disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-neutral-300',
        error: 'border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:ring-green-500',
      },
      size: {
        sm: 'h-8 px-2 text-sm',
        md: 'h-10 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export const Input = React.forwardRef(
  (
    { variant = 'default', size = 'md', type = 'text', className, ...props },
    ref
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

Input.displayName = 'Input';

const textareaVariants = cva(
  'flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:border-transparent disabled:cursor-not-allowed disabled:bg-neutral-50 transition-colors resize-none',
  {
    variants: {
      variant: {
        default: 'border-neutral-300',
        error: 'border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:ring-green-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export const Textarea = React.forwardRef(
  ({ variant = 'default', className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={textareaVariants({ variant, className })}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

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
      <div className={`flex flex-col gap-1 ${className || ''}`} ref={ref}>
        {label && (
          <label className="text-sm font-medium text-neutral-900">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {children}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="text-sm text-neutral-500">{hint}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default Input;
