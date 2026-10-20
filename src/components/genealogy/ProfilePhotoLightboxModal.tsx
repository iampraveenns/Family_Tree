import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FamilyMember } from '../../types/index.ts';

export interface ProfilePhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember;
  photoUrl: string;
}

export const ProfilePhotoLightboxModal: React.FC<ProfilePhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  member,
  photoUrl,
}) => {
  const [mounted, setMounted] = useState(false);
  const [fullscreenEl, setFullscreenEl] = useState<Element | null>(
    typeof document !== 'undefined' ? document.fullscreenElement : null
  );
  const stableTargetRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setFullscreenEl(document.fullscreenElement);
      } else if (!isOpen) {
        setFullscreenEl(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen]);

  if (isOpen && !stableTargetRef.current) {
    stableTargetRef.current =
      (fullscreenEl as HTMLElement) ||
      (typeof document !== 'undefined'
        ? (document.fullscreenElement as HTMLElement) || document.body
        : null);
  } else if (!isOpen && stableTargetRef.current) {
    stableTargetRef.current = null;
  }

  // Keyboard accessibility: Escape key closes the lightbox
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fullName =
    member.displayName ||
    `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
    'Family Member';

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Full profile photo of ${fullName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(248, 250, 252, 0.94)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999,
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-50/95 backdrop-blur-[8px] select-none"
        >
          {/* Top-Right Accessible Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close profile picture"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 p-2.5 rounded-full text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Centered Image Container with subtle scale-up animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center justify-center max-w-[92vw] sm:max-w-[90vw] max-h-[85vh] outline-hidden"
          >
            {/* The full-size photo */}
            <img
              src={photoUrl}
              alt={`Full profile photo of ${fullName}`}
              className="max-w-[92vw] sm:max-w-[90vw] max-h-[75vh] sm:max-h-[80vh] object-contain rounded-xl sm:rounded-2xl shadow-xl ring-1 ring-slate-200 bg-white"
            />

            {/* Member Name Caption */}
            <div className="mt-3 text-center">
              <h3 className="text-[#0F172A] text-base sm:text-lg font-bold tracking-wide">
                {fullName}
              </h3>
              {member.branchName && (
                <p className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
                  {member.branchName}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const portalTarget =
    (stableTargetRef.current && stableTargetRef.current.isConnected
      ? stableTargetRef.current
      : null) ||
    (fullscreenEl as HTMLElement) ||
    (typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || document.body : null);

  if (typeof document !== 'undefined' && mounted && portalTarget) {
    return createPortal(modalContent, portalTarget);
  }

  return modalContent;
};
