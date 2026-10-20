import React from 'react';

export interface GlassCardProps {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  hoverEffect?: boolean;
  glow?: 'none' | 'accent' | 'emerald';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  id,
  onClick,
  hoverEffect = true,
  glow = 'none',
}) => {
  const glowClasses = {
    none: '',
    accent: 'hover:shadow-[0_12px_36px_-6px_rgba(37,99,235,0.22)] hover:border-[#2563EB]/60',
    emerald: 'hover:shadow-[0_12px_36px_-6px_rgba(16,185,129,0.22)] hover:border-emerald-500/60',
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative rounded-2xl p-5 md:p-6 glass-panel shadow-card transition-all duration-300 transform-gpu ${
        hoverEffect ? 'hover:-translate-y-1 hover:shadow-card-hover' : ''
      } ${glowClasses[glow]} ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
