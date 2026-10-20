import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  id?: string;
}

export const Dropdown = ({
  trigger,
  items,
  align = 'right',
  className = '',
  id = 'familyroots-dropdown',
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`} id={id}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-56 origin-top-right rounded-xl bg-white p-1.5 shadow-lg border border-slate-200 z-40 animate-in fade-in duration-150`}
        >
          {items.map((item) => {
            if (item.divider) {
              return (
                <div
                  key={item.id}
                  className="my-1 border-t border-slate-100"
                />
              );
            }
            return (
              <button
                key={item.id}
                id={`${id}-item-${item.id}`}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs md:text-sm rounded-lg text-left transition-colors ${
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                    : item.danger
                    ? 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                    : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                {item.icon && <span className="w-4 h-4 shrink-0 text-slate-500">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
