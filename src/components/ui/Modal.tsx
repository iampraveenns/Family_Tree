import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  id = 'familyroots-modal',
  className = '',
  style,
}: ModalProps) => {
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const [mounted, setMounted] = useState(false);
  const [fullscreenEl, setFullscreenEl] = useState<Element | null>(
    typeof document !== 'undefined' ? document.fullscreenElement : null
  );
  const stableTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const handleFullscreenChange = () => {
      // If modal is open, avoid mutating fullscreenEl to prevent unmounting the active dialog
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

  // Lock portal target when modal opens, clear when closed
  if (isOpen && !stableTargetRef.current) {
    stableTargetRef.current =
      (fullscreenEl as HTMLElement) ||
      (typeof document !== 'undefined'
        ? (document.fullscreenElement as HTMLElement) || document.body
        : null);
  } else if (!isOpen && stableTargetRef.current) {
    stableTargetRef.current = null;
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus trapping and keyboard management - stable across renders
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore upon modal close
    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    document.body.style.overflow = 'hidden';

    // Focus first interactive element only if focus is not already inside the dialog
    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        if (!dialogRef.current.contains(document.activeElement)) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0]?.focus();
          } else {
            dialogRef.current.focus();
          }
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus safely upon closing
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const portalTarget =
    (stableTargetRef.current && stableTargetRef.current.isConnected
      ? stableTargetRef.current
      : null) ||
    (fullscreenEl as HTMLElement) ||
    (typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || document.body : null);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.05 : 0.2 }}
          style={{ zIndex: 99999 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? `${id}-title` : undefined}
            aria-describedby={description ? `${id}-desc` : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.94, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, y: shouldReduceMotion ? 0 : 6 }}
            transition={{
              type: shouldReduceMotion ? 'tween' : 'spring',
              damping: 26,
              stiffness: 300,
            }}
            style={style}
            className={`w-full ${maxWidthStyles[maxWidth]} rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-[#DCE7F3] max-h-[90vh] overflow-y-auto outline-hidden ${className}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                {title && (
                  <h2
                    id={`${id}-title`}
                    className="text-lg md:text-xl font-bold text-[#17233C] tracking-tight"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id={`${id}-desc`}
                    className="text-xs md:text-sm text-[#64748B] mt-1"
                  >
                    {description}
                  </p>
                )}
              </div>
              <button
                id={`${id}-close-button`}
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#17233C]/70 hover:text-[#17233C] hover:bg-[#EFF6FF] active:bg-[#DBEAFE] transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-hidden cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2 text-[#1E293B] text-sm">
              {children}
            </div>

            {footer && (
              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined' && mounted && portalTarget) {
    return createPortal(modalContent, portalTarget);
  }

  return modalContent;
};
