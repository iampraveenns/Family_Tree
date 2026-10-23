import React from 'react';
import { MiniMap } from 'reactflow';
import {
  Plus,
  Minus,
  Maximize,
  Sparkles,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  X,
} from 'lucide-react';

export interface TreeFloatingControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitFamily: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  showHint: boolean;
  onDismissHint: () => void;
  selectedMemberName?: string;
  onClearFocus?: () => void;
  isDrawerOpen?: boolean;
  isMemoriesSidebarOpen?: boolean;
  onToggleMemoriesSidebar?: () => void;
  memoriesCount?: number;
}

export const TreeFloatingControls: React.FC<TreeFloatingControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitFamily,
  isFocusMode,
  onToggleFocusMode,
  isFullscreen,
  onToggleFullscreen,
  showMiniMap,
  onToggleMiniMap,
  showHint,
  onDismissHint,
  selectedMemberName,
  onClearFocus,
  isDrawerOpen = false,
  isMemoriesSidebarOpen = false,
  onToggleMemoriesSidebar,
  memoriesCount,
}) => {
  return (
    <>
      {/* Floating Action Toolbar */}
      <div
        data-testid="tree-floating-controls"
        className={`absolute top-5 right-5 ${
          isDrawerOpen || isMemoriesSidebarOpen ? 'sm:right-[436px]' : ''
        } z-35 flex items-center gap-1 p-1.5 rounded-xl bg-white border-[1.5px] border-[#B8D4FF] shadow-md transition-all duration-200 max-w-[calc(100vw-40px)] overflow-x-auto`}
      >
        {/* Zoom In */}
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom In"
          title="Zoom In"
          className="p-1.5 rounded-lg text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE] transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom Out"
          title="Zoom Out"
          className="p-1.5 rounded-lg text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE] transition-colors cursor-pointer shrink-0"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="w-[1.5px] h-4 bg-[#B8D4FF] shrink-0" />

        {/* Fit Family */}
        <button
          type="button"
          onClick={onFitFamily}
          aria-label="Fit Family to Screen"
          title="Center and Fit Entire Family"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE] transition-colors cursor-pointer shrink-0"
        >
          <Maximize className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="hidden sm:inline text-xs font-semibold">Fit Family</span>
        </button>

        {/* Focus Mode */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          aria-label="Toggle Focus Mode"
          title={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode (dim unrelated relatives)'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
            isFocusMode
              ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
              : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE]'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isFocusMode ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
          <span className="hidden sm:inline text-xs font-semibold">Focus</span>
        </button>

        <div className="w-[1.5px] h-4 bg-[#B8D4FF] shrink-0" />

        {/* Fullscreen / Exit Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
            isFullscreen
              ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#B8D4FF]'
              : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE]'
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4 text-[#2563EB]" />
              <span className="hidden sm:inline text-xs font-semibold text-[#2563EB]">Exit Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Fullscreen</span>
            </>
          )}
        </button>

        {/* Memories Sidebar Toggle Button */}
        {onToggleMemoriesSidebar && (
          <>
            <div className="w-[1.5px] h-4 bg-[#B8D4FF] shrink-0" />
            <button
              type="button"
              onClick={onToggleMemoriesSidebar}
              data-testid="toggle-memories-sidebar-button"
              aria-label={isMemoriesSidebarOpen ? 'Close Memories Sidebar' : 'Open Memories Sidebar'}
              title={isMemoriesSidebarOpen ? 'Close Memories Sidebar' : 'Open Memories Sidebar (Photos, Videos, Audios)'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer shrink-0 text-xs font-semibold ${
                isMemoriesSidebarOpen
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] active:bg-[#DBEAFE]'
              }`}
            >
              <span>Memories</span>
              {typeof memoriesCount === 'number' && memoriesCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isMemoriesSidebarOpen
                      ? 'bg-white/25 text-white'
                      : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  }`}
                >
                  {memoriesCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Focus Mode Notification & Clear Focus (Requirement 10) */}
      {(isFocusMode || selectedMemberName) && onClearFocus && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#B8D4FF] shadow-md">
          <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
          <span className="text-xs font-medium text-[#17233C]">
            {isFocusMode && selectedMemberName
              ? `Focused on ${selectedMemberName}`
              : isFocusMode
              ? 'Focus Mode active'
              : `Selected: ${selectedMemberName}`}
          </span>
          <button
            type="button"
            onClick={onClearFocus}
            className="ml-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer flex items-center gap-0.5"
            title="Reset focus and view all family members"
          >
            <span>Clear Focus</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Collapsible MiniMap Control (Requirement 9) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        {showMiniMap && (
          <div className="rounded-xl overflow-hidden border-[1.5px] border-[#B8D4FF] shadow-lg bg-white p-1">
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'generationMarker' || node.type === 'coupleJunction') {
                  return 'transparent';
                }
                return '#fef08a';
              }}
              nodeStrokeColor="#B8D4FF"
              nodeStrokeWidth={1.5}
              maskColor="rgba(255, 255, 255, 0.7)"
              className="!relative !m-0 !rounded-lg !border-none !w-44 !h-28"
            />
          </div>
        )}

        {/* Toggle MiniMap Button */}
        <button
          type="button"
          onClick={onToggleMiniMap}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#B8D4FF] shadow-md text-xs font-semibold text-[#17233C] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-all cursor-pointer"
        >
          <MapIcon className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>{showMiniMap ? 'Hide Map' : 'Show Map'}</span>
        </button>
      </div>

      {/* Small Unobtrusive Help Hint (Requirement 13) */}
      {showHint && !selectedMemberName && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border-[1.5px] border-[#B8D4FF] shadow-sm text-xs text-[#475569]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
          <span>Select a member to explore their family</span>
          <button
            type="button"
            onClick={onDismissHint}
            className="p-0.5 ml-1 text-[#64748B] hover:text-[#17233C] rounded cursor-pointer"
            title="Dismiss hint"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </>
  );
};
