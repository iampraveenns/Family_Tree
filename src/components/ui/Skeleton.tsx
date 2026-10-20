import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-slate-200';

  const variantClasses = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'rounded-2xl h-48',
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return <div style={style} className={`${baseClasses} ${variantClasses[variant]} ${className}`} />;
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-5 rounded-2xl border border-slate-200 bg-white space-y-3 ${className}`}>
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="space-y-1.5 flex-1">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
    <Skeleton variant="rectangular" height={80} />
  </div>
);
