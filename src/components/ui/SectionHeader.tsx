import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  icon,
  action,
  className = '',
  id,
}) => {
  return (
    <div id={id} className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 ${className}`}>
      <div>
        {eyebrow && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[#2563EB] mb-1">
            {icon}
            <span>{eyebrow}</span>
          </div>
        )}
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0F172A] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#475569] mt-1 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2 mt-2 sm:mt-0">{action}</div>}
    </div>
  );
};
