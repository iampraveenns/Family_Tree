import React from 'react';
import { Handle, Position } from 'reactflow';
import { Heart } from 'lucide-react';

export interface CoupleJunctionData {
  parentAId: string;
  parentBId: string;
  childrenIds: string[];
  marriageDate?: string | null;
  isDimmed?: boolean;
}

export function formatMarriageDate(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '—') return null;

  const matchFull = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchFull) {
    const year = parseInt(matchFull[1], 10);
    const month = parseInt(matchFull[2], 10) - 1;
    const day = parseInt(matchFull[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${monthNames[month]} ${year}`;
    }
  }

  const matchYear = trimmed.match(/^(\d{4})$/);
  if (matchYear) return matchYear[1];

  return trimmed;
}

export const CoupleJunctionNode: React.FC<{ data: CoupleJunctionData }> = React.memo(({ data }) => {
  const { isDimmed } = data;

  return (
    <div
      style={{ width: 24, height: 24 }}
      className={`relative w-6 h-6 rounded-full bg-white border-[1.5px] border-[#7EA7D9] shadow-xs flex items-center justify-center transition-all ${
        isDimmed ? 'opacity-20' : 'opacity-100'
      }`}
    >
      {/* Target handle from Parent A (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-1.5 !h-1.5 !bg-[#7EA7D9] !border-none !-left-1"
      />

      {/* Source handle to Parent B (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-1.5 !h-1.5 !bg-[#7EA7D9] !border-none !-right-1"
      />

      {/* Top Handle if connecting from an ancestor */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-1.5 !h-1.5 !bg-[#7EA7D9] !border-none !-top-1 opacity-0"
      />

      {/* Center Wedding Union Symbol: clean and minimal [Node] ── ♡ ── [Node] */}
      <Heart className="w-3 h-3 text-[#7EA7D9] fill-[#EFF6FF] select-none" />

      {/* Source handle descending to Children (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-bottom-1"
      />
    </div>
  );
});

CoupleJunctionNode.displayName = 'CoupleJunctionNode';
