import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserPlus, Heart, Plus, Loader2 } from 'lucide-react';

export interface StarterNodeData {
  isStarterNode: true;
  starterType: 'member' | 'spouse';
  title?: string;
  label?: string;
  ctaLabel?: string;
  partnerMemberId?: string;
  isLoading?: boolean;
  onAddStarterMember?: () => void;
  onAddStarterSpouse?: (partnerId?: string) => void;
}

export const StarterMemberNode: React.FC<NodeProps<StarterNodeData>> = memo(({ data }) => {
  const isMember = data.starterType === 'member';
  const isLoading = Boolean(data.isLoading);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    if (isMember) {
      data.onAddStarterMember?.();
    } else {
      data.onAddStarterSpouse?.(data.partnerMemberId);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (isLoading) return;
      if (isMember) {
        data.onAddStarterMember?.();
      } else {
        data.onAddStarterSpouse?.(data.partnerMemberId);
      }
    }
  };

  return (
    <div
      role="region"
      tabIndex={0}
      style={{
        width: 280,
        height: 160,
        backgroundColor: '#D3D3D3',
      }}
      aria-label={isMember ? 'Empty starter member card' : 'Empty starter spouse card'}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      className="group relative w-[280px] h-[160px] box-border rounded-2xl border-[1.5px] border-dashed border-slate-400 p-3 transition-all duration-200 select-none flex flex-col justify-between items-center text-center bg-[#D3D3D3] shadow-xs overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 hover:border-slate-600 hover:shadow-md"
    >
      {/* Target/Source Connection Handles for Left/Right Couple Linking */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-left-1 opacity-80"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-right-1 opacity-80"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-top-1 opacity-40"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-bottom-1 opacity-40"
      />

      {/* Subtle Top Accent Bar */}
      <div
        className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-[#7EA7D9]"
      />

      {/* Top Section: Icon, Role & Subtitle */}
      <div className="flex flex-col items-center justify-center pt-0.5 w-full">
        <div
          className="w-9 h-9 rounded-full border border-dashed border-[#B8D4FF] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
        >
          {isMember ? (
            <UserPlus className="w-4.5 h-4.5 stroke-[2]" />
          ) : (
            <Heart className="w-4.5 h-4.5 stroke-[2] text-[#2563EB]" />
          )}
        </div>

        <h3 className="text-[13px] font-bold text-[#17233C] mt-1 leading-tight group-hover:text-[#2563EB] transition-colors">
          {isMember ? 'Member' : 'Spouse'}
        </h3>
        <p className="text-[11.5px] text-[#17233C]/80 mt-0.5 leading-tight">
          {isMember ? 'Start your family here' : 'Connect your spouse here'}
        </p>
      </div>

      {/* Bottom Primary CTA Action Button */}
      <div className="w-full">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={isMember ? 'Add Member' : 'Add Spouse'}
          aria-busy={isLoading}
          className={`w-full py-2 px-3 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            isMember
              ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white active:scale-[0.98] focus-visible:ring-[#2563EB]'
              : 'bg-white border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] active:scale-[0.98] focus-visible:ring-[#2563EB]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isMember ? 'Adding...' : 'Connecting...'}</span>
            </>
          ) : isMember ? (
            <>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Member</span>
            </>
          ) : (
            <>
              <Heart className="w-4 h-4 fill-[#2563EB]/20 text-[#2563EB]" />
              <span>Add Spouse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
