import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../ui/Modal.tsx';
import { FamilyMember } from '../../types/index.ts';

export interface EditLifeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
  onSave: (memberId: string, isLiving: boolean, deathDate: string | null) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Normalizes an arbitrary date string (ISO, YYYY-MM-DD, etc.) into YYYY-MM-DD for <input type="date" />
 */
function toDateInputValue(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '—') return '';

  const ymdMatch = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1000) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

export const EditLifeStatusModal: React.FC<EditLifeStatusModalProps> = ({
  isOpen,
  onClose,
  member,
  onSave,
  isLoading = false,
}) => {
  const isDeceasedInitially = member ? (!member.isLiving || Boolean(member.dateOfDeath)) : false;
  const [status, setStatus] = useState<'LIVING' | 'DECEASED'>(() =>
    isDeceasedInitially ? 'DECEASED' : 'LIVING'
  );
  const [deathDate, setDeathDate] = useState<string>(() =>
    isDeceasedInitially && member ? toDateInputValue(member.dateOfDeath) : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens or active member changes
  useEffect(() => {
    if (isOpen && member) {
      const isDeceased = !member.isLiving || Boolean(member.dateOfDeath);
      setStatus(isDeceased ? 'DECEASED' : 'LIVING');
      setDeathDate(isDeceased ? toDateInputValue(member.dateOfDeath) : '');
      setError(null);
    }
  }, [isOpen, member]);

  const handleStatusChange = (newStatus: 'LIVING' | 'DECEASED') => {
    setStatus(newStatus);
    setError(null);
    if (newStatus === 'LIVING') {
      // Clear DOD from form state when switching to Living
      setDeathDate('');
    } else if (newStatus === 'DECEASED' && member?.dateOfDeath) {
      // Restore previously saved death date if available
      setDeathDate(toDateInputValue(member.dateOfDeath));
    }
  };

  const handleCancel = () => {
    if (isLoading) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || isLoading) return;

    try {
      const isLiving = status === 'LIVING';
      const effectiveDeathDate = isLiving ? null : (deathDate.trim() || null);

      await onSave(member.id, isLiving, effectiveDeathDate);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update life status');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={
        <span className="text-lg md:text-xl font-bold text-[#17233C] tracking-tight">
          Edit Life Status
        </span>
      }
      maxWidth="sm"
      id="edit-life-status-modal"
      className="!bg-[#FFF9D6] !border-[#B8D4FF] !rounded-[22px] shadow-[0_16px_48px_rgba(37,99,235,0.10),0_4px_16px_rgba(23,35,60,0.06)] text-[#17233C]"
      style={{ backgroundColor: '#FFF9D6', color: '#17233C' }}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-0.5" noValidate={false}>
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Status Section using interactive Living & RIP radio-button layout */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17233C] block">
            Status
          </label>
          <div className="flex items-center gap-2 p-1 rounded-xl bg-[#FFF9D6] border border-[#B8D4FF] shadow-[0_1px_3px_rgba(23,35,60,0.04)]">
            {/* Living Option */}
            <label
              className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer select-none text-xs sm:text-sm ${
                status === 'LIVING'
                  ? 'bg-[#FEF08A]/60 border-[#B8D4FF] text-[#17233C] font-semibold shadow-2xs'
                  : 'bg-transparent border-transparent text-[#17233C]/75 hover:bg-[#FEF08A]/30 hover:text-[#17233C] font-medium'
              }`}
            >
              <input
                type="radio"
                name="lifeStatus"
                value="LIVING"
                checked={status === 'LIVING'}
                onChange={() => handleStatusChange('LIVING')}
                disabled={isLoading}
                className="w-4 h-4 accent-[#2563EB] cursor-pointer"
              />
              <span>Living</span>
            </label>

            {/* RIP Option */}
            <label
              className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer select-none text-xs sm:text-sm ${
                status === 'DECEASED'
                  ? 'bg-[#FEF08A]/60 border-[#B8D4FF] text-[#17233C] font-semibold shadow-2xs'
                  : 'bg-transparent border-transparent text-[#17233C]/75 hover:bg-[#FEF08A]/30 hover:text-[#17233C] font-medium'
              }`}
            >
              <input
                type="radio"
                name="lifeStatus"
                value="DECEASED"
                checked={status === 'DECEASED'}
                onChange={() => handleStatusChange('DECEASED')}
                disabled={isLoading}
                className="w-4 h-4 accent-[#2563EB] cursor-pointer"
              />
              <span data-testid="status-radio-rip">RIP (Rest in Peace)</span>
            </label>
          </div>
        </div>

        {/* Death Date (DOD) conditionally placed directly BELOW Status with smooth 180ms transition */}
        <AnimatePresence initial={false}>
          {status === 'DECEASED' && (
            <motion.div
              key="dod-field"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="death-date-input"
                  className="text-xs font-semibold text-[#17233C] block"
                >
                  Death Date (DOD)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="death-date-input"
                    type="date"
                    value={deathDate}
                    onChange={(e) => {
                      setDeathDate(e.target.value);
                      setError(null);
                    }}
                    disabled={isLoading}
                    placeholder="dd-mm-yyyy"
                    className="w-full rounded-xl border border-[#B8D4FF] bg-white px-3.5 py-2.5 text-sm text-[#17233C] placeholder-[#94A3B8] transition-all duration-150 hover:border-[#7EA7D9] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#BFDBFE] focus-visible:border-[#2563EB] disabled:bg-[#F8FAFC] disabled:cursor-not-allowed shadow-2xs"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons: [Cancel] [Save] */}
        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#17233C] bg-white border border-[#B8D4FF] hover:bg-[#EFF6FF] hover:border-[#7EA7D9] active:bg-[#DBEAFE] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 flex items-center gap-1.5"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

