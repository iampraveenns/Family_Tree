import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GitFork, LogOut } from 'lucide-react';
import { clearAuthTokens } from '../utils/api.ts';
import { NotificationBell } from '../components/navigation/NotificationBell.tsx';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearAuthTokens();
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] antialiased select-none">
      {/* Sleek Minimal Header for Family Tree - All Clean Light Styling */}
      <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 shadow-xs">
        {/* Left: Brand Application Name & Active Role Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <GitFork className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-[#0F172A] tracking-tight">
              FamilyTree
            </span>
          </div>
        </div>

        {/* Right: Notification Bell (directly to left of Sign Out) & Sign Out */}
        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer bg-white"
            title="Sign out and return to signup page"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Full-Height Canvas Area in Pure Light Color */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative bg-[#F8FAFC]">
        <Outlet />
      </main>
    </div>
  );
};
