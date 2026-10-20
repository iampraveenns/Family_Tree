import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'emerald' | 'coral' | 'lavender' | 'sky' | 'amber' | 'stone' | 'rose';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  id?: string;
}

export const Badge = ({
  children,
  variant = 'stone',
  size = 'md',
  dot = false,
  className = '',
  id,
}: BadgeProps) => {
  const variantStyles = {
    primary:
      'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
    emerald:
      'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
    coral:
      'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
    lavender:
      'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
    sky:
      'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
    amber:
      'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    stone:
      'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
    rose:
      'bg-rose-50 text-rose-800 border-rose-200',
  };

  const dotColors = {
    primary: 'bg-[#2563EB]',
    emerald: 'bg-[#16A34A]',
    coral: 'bg-[#E9785B]',
    lavender: 'bg-[#8B7CF6]',
    sky: 'bg-[#3B82F6]',
    amber: 'bg-[#F59E0B]',
    stone: 'bg-[#64748B]',
    rose: 'bg-rose-600',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center font-medium rounded-full border whitespace-nowrap select-none ${
        sizeStyles[size]
      } ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
