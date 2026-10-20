import React from 'react';
import { Button } from './Button.tsx';
import { Badge } from './Badge.tsx';

interface EmptyStateProps {
  id?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badgeText?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'outline' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  id,
  icon,
  title,
  description,
  badgeText,
  primaryAction,
  secondaryAction,
  className = '',
  children,
}) => {
  return (
    <div
      id={id}
      className={`rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6 sm:p-10 text-center transition-all ${className}`}
    >
      <div className="max-w-md mx-auto space-y-4">
        {/* Icon & Badge */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shadow-xs">
            {icon}
          </div>
          {badgeText && (
            <Badge variant="sky" size="sm">
              {badgeText}
            </Badge>
          )}
        </div>

        {/* Text Content */}
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Custom content */}
        {children && <div className="pt-2">{children}</div>}

        {/* Action Buttons */}
        {(primaryAction || secondaryAction) && (
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            {primaryAction && (
              <Button
                id={id ? `${id}-primary-btn` : undefined}
                onClick={primaryAction.onClick}
                variant={primaryAction.variant || 'primary'}
                leftIcon={primaryAction.icon}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                id={id ? `${id}-secondary-btn` : undefined}
                onClick={secondaryAction.onClick}
                variant="outline"
                leftIcon={secondaryAction.icon}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
