import React from 'react';
import { History, X, ArrowUpRight } from 'lucide-react';

interface RecentSearchesProps {
  searches: string[];
  onSelect: (search: string) => void;
  onClear: () => void;
  onRemoveItem: (search: string) => void;
  className?: string;
}

export const RecentSearches: React.FC<RecentSearchesProps> = ({
  searches,
  onSelect,
  onClear,
  onRemoveItem,
  className = '',
}) => {
  if (!searches || searches.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="font-semibold tracking-wide uppercase text-[11px]">Recent Searches</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
        >
          Clear history
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {searches.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 group hover:border-blue-400 transition-colors"
          >
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex items-center gap-1 hover:text-[#2563EB] cursor-pointer"
            >
              <span>{item}</span>
              <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveItem(item);
              }}
              className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label={`Remove ${item}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};
