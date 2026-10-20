import React from 'react';

export interface CardProps {
  children?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass' | 'bordered';
  className?: string;
  id?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  id,
  onClick,
  style,
}) => {
  const variantStyles = {
    default:
      'bg-white border border-[#DCE7F3] shadow-card',
    elevated:
      'bg-white border border-[#DCE7F3] shadow-card-hover',
    glass:
      'bg-white/95 backdrop-blur-md border border-[#DCE7F3] shadow-card',
    bordered:
      'bg-transparent border border-[#DCE7F3]',
  };

  return (
    <div
      id={id}
      onClick={onClick}
      style={style}
      className={`rounded-2xl p-5 md:p-6 transition-all duration-200 ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
    <div>
      <h3 className="text-base md:text-lg font-semibold text-[#1E293B]">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
