import React from 'react';
import { Layers } from 'lucide-react';

export interface GenerationMarkerData {
  generation: number;
  label: string;
  subtitle?: string;
  lineSpanWidth: number;
}

export const GenerationMarkerNode: React.FC<{ data: GenerationMarkerData }> = React.memo(({ data }) => {
  const { generation, subtitle, lineSpanWidth } = data;

  return (
    <div className="relative pointer-events-none select-none flex items-center">
      {/* Dedicated Left-side Generation Indicator */}
      <div className="relative z-10 flex flex-col justify-center px-3 py-1.5 rounded-xl bg-white border border-[#B8D4FF] shadow-[0_2px_8px_rgba(23,35,60,0.06)] min-w-[160px]">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="text-[11px] font-bold tracking-wider text-[#2563EB] uppercase">
            GEN {generation}
          </span>
        </div>
        {subtitle && (
          <span className="text-[10px] font-medium text-[#17233C]/70 truncate mt-0.5 max-w-[150px]">
            {subtitle}
          </span>
        )}
      </div>

      {/* Subtle Horizontal Guide Line across the family row */}
      <div
        className="h-[1px] bg-gradient-to-r from-[#B8D4FF] via-[#E2E8F0]/50 to-transparent pointer-events-none -ml-1 -z-10"
        style={{ width: `${Math.max(400, lineSpanWidth)}px` }}
      />
    </div>
  );
});

GenerationMarkerNode.displayName = 'GenerationMarkerNode';
