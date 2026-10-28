import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { GitFork, LogOut, ShieldAlert, ShieldCheck, Eye, LayoutDashboard } from 'lucide-react';
import { clearAuthTokens } from '../utils/api.ts';
import { NotificationBell } from '../components/navigation/NotificationBell.tsx';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<string>('ADMIN');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('familyroots_user_role') || localStorage.getItem('familyroots_selected_role');
      if (stored) {
        setRole(stored.toUpperCase());
      }
    } catch {}
  }, [location.pathname]);

  const handleSignOut = () => {
    clearAuthTokens();
    localStorage.removeItem('familyroots_user_role');
    navigate('/');
  };

  const isSuperAdmin = role === 'SUPER_ADMIN' || location.pathname.startsWith('/super-admin');
  const isViewer = role === 'VIEWER';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] antialiased select-none">
      {/* Sleek Minimal Header for Family Tree - All Clean Light Styling with Top-Priority Stacking Context */}
      <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-[9999] overflow-visible shadow-xs">
        {/* Left: Brand Application Name & Active Role Indicator Stacked Directly Below */}
        <div className="flex items-center gap-3">
          <Link
            to={isSuperAdmin ? '/super-admin/dashboard' : '/family/tree'}
            className="flex items-center gap-2.5 hover:opacity-95"
            title="FamilyTree Navigation"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs shrink-0">
              <GitFork className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col items-start justify-center">
              <span className="font-extrabold text-[15px] sm:text-base text-[#0F172A] tracking-tight leading-tight">
                FamilyTree
              </span>
              {/* Active Role/Login Title Indicator Stacked Directly Below FamilyTree Title */}
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded-md mt-0.5 shadow-2xs leading-none">
                  <ShieldAlert className="w-2.5 h-2.5 text-indigo-600" />
                  <span>Super Admin</span>
                </span>
              ) : isViewer ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-1.5 py-0.5 rounded-md mt-0.5 shadow-2xs leading-none">
                  <Eye className="w-2.5 h-2.5 text-sky-600" />
                  <span>Viewer</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-md mt-0.5 shadow-2xs leading-none">
                  <ShieldCheck className="w-2.5 h-2.5 text-[#2563EB]" />
                  <span>Admin</span>
                </span>
              )}
            </div>
          </Link>

          {/* Super Admin Status Indicator (Isolated from Family Tree) */}
          {isSuperAdmin && (
            <div className="hidden sm:flex items-center ml-2 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 shadow-2xs">
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600 mr-1" />
              <span>Super Admin Portal</span>
            </div>
          )}
        </div>

        {/* Right: Notification Bell (directly to left of Sign Out) & Sign Out - Top Priority Stacking */}
        <div className="flex items-center gap-2 relative z-[9999] overflow-visible">
          <NotificationBell />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer bg-white"
            title="Sign out and return to login page"
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
