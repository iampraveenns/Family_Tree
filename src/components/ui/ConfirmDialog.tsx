import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button.tsx';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div className="relative w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-full shrink-0 ${
              isDestructive
                ? 'bg-rose-100 text-rose-600'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-base font-bold text-[#0F172A]">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
            }
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
