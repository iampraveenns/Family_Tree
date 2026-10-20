import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { GitFork, LogOut, ChevronDown, Plus } from 'lucide-react';
import { useFamilyStore } from '../stores/useFamilyStore.ts';
import { clearAuthTokens } from '../utils/api.ts';
import { CreateFamilyModal } from '../components/genealogy/CreateFamilyModal.tsx';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentFamily,
    availableFamilies,
    activeFamilyId,
    setActiveFamilyId,
    fetchAvailableFamilies,
  } = useFamilyStore();

  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);

  useEffect(() => {
    fetchAvailableFamilies();
  }, [fetchAvailableFamilies]);

  const handleSignOut = () => {
    clearAuthTokens();
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] antialiased select-none">
      {/* Sleek Minimal Header for Family Tree - All Clean Light Styling */}
      <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 shadow-xs">
        {/* Left: Brand + Active Family */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
              <GitFork className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-[#0F172A] tracking-tight">
              FamilyRoots
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Active Family Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFamilyDropdownOpen(!familyDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1E293B] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors cursor-pointer border border-[#CBD5E1]"
            >
              <span>{currentFamily?.name || 'Pattara Family'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {familyDropdownOpen && (
              <div className="absolute left-0 mt-1 w-56 rounded-xl bg-white border border-[#E2E8F0] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Select Family Vault
                </div>
                {availableFamilies.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setActiveFamilyId(fam.id);
                      setFamilyDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                      fam.id === (activeFamilyId || currentFamily?.id)
                        ? 'text-[#2563EB] font-bold bg-blue-50/50'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{fam.name}</span>
                    {fam.id === (activeFamilyId || currentFamily?.id) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                    )}
                  </button>
                ))}
                <div className="border-t border-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setFamilyDropdownOpen(false);
                    setIsCreateFamilyModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#2563EB] hover:bg-blue-50 font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Family</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sign Out */}
        <div className="flex items-center gap-2">
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

      {/* Create Family Modal */}
      {isCreateFamilyModalOpen && (
        <CreateFamilyModal
          isOpen={isCreateFamilyModalOpen}
          onClose={() => setIsCreateFamilyModalOpen(false)}
        />
      )}
    </div>
  );
};
