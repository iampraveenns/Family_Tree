import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'coral' | 'lavender';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[38px] sm:min-h-[32px]',
      md: 'px-4 py-2 text-sm gap-2 min-h-[44px]',
      lg: 'px-5 py-2.5 text-base gap-2.5 min-h-[48px]',
    };

    const variantStyles = {
      primary:
        'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] shadow-xs hover:shadow-sm focus-visible:ring-[#2563EB]',
      coral:
        'bg-[#E9785B] text-white hover:bg-[#D66347] active:bg-[#C25237] shadow-xs hover:shadow-sm focus-visible:ring-[#E9785B]',
      lavender:
        'bg-[#8B7CF6] text-white hover:bg-[#7867ED] active:bg-[#6754E0] shadow-xs hover:shadow-sm focus-visible:ring-[#8B7CF6]',
      secondary:
        'bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] active:bg-[#BFDBFE] focus-visible:ring-[#2563EB]',
      outline:
        'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#2563EB] hover:text-[#2563EB] active:bg-[#EFF6FF] focus-visible:ring-[#2563EB]',
      ghost:
        'bg-transparent text-[#475569] hover:bg-[#EFF6FF] hover:text-[#2563EB] active:bg-[#DBEAFE] focus-visible:ring-[#2563EB]',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 shadow-xs hover:shadow-sm',
    };

    return (
      <button
        ref={ref}
        id={id}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? 'true' : undefined}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
        )}
        <span className="whitespace-nowrap">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0" aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
