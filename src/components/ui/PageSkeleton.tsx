import React from 'react';

export interface PageSkeletonProps {
  title?: string;
  subtitle?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  title = 'Loading family vault records...',
  subtitle = 'Retrieving verified heritage archives',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse"
    >
      {/* Header bar skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 bg-slate-100 rounded-xl" />
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Grid / Content skeleton */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-28 bg-slate-200 rounded-md" />
                <div className="h-3 w-40 bg-slate-100 rounded-md" />
              </div>
            </div>
            <div className="h-24 rounded-xl bg-slate-50" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
              <div className="h-4 w-16 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">{title} - {subtitle}</span>
    </div>
  );
};
