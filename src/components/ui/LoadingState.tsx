import React from 'react';

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading family heritage data...',
  subMessage = 'Connecting generational records and relationships',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center select-none ${className}`}
      id="familyroots-loading-state"
    >
      {/* Heritage Rings in clean Royal Blue */}
      <div className="relative flex items-center justify-center mb-5">
        <div className="absolute w-16 h-16 rounded-full bg-blue-100 blur-xl" />
        
        {/* Outer Ring */}
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-blue-300 border-t-[#2563EB] animate-spin" style={{ animationDuration: '3s' }} />
        
        {/* Inner Ring */}
        <div className="absolute w-10 h-10 rounded-full border-2 border-blue-200 border-b-[#2563EB] animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
        
        {/* Center Heraldic Monogram */}
        <div className="absolute w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center shadow-xs">
          <span className="text-[11px] font-bold text-white">F</span>
        </div>
      </div>

      <h4 className="text-base font-semibold text-[#0F172A]">
        {message}
      </h4>
      {subMessage && (
        <p className="text-xs text-[#64748B] mt-1.5 max-w-sm leading-relaxed">
          {subMessage}
        </p>
      )}
    </div>
  );
};
