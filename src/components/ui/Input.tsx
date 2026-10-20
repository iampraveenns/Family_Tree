import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = inputId ? `${inputId}-error` : undefined;
    const helperId = inputId ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[#334155]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#64748B] pointer-events-none flex items-center" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] transition duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#BFDBFE] focus-visible:border-[#2563EB] disabled:bg-[#F8FAFC] disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error
                ? 'border-rose-400 focus-visible:ring-rose-500'
                : 'border-[#CBD5E1]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[#64748B] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[#64748B]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
