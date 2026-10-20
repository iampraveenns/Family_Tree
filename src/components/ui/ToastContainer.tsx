import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '../../stores/useToastStore.ts';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
    info: <Info className="w-4 h-4 text-[#2563EB] shrink-0" />,
  };

  const borderMap = {
    success: 'border-emerald-200 bg-white',
    error: 'border-rose-200 bg-white',
    warning: 'border-amber-200 bg-white',
    info: 'border-blue-200 bg-white',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg ${borderMap[toast.type]}`}
          >
            <div className="mt-0.5">{iconMap[toast.type]}</div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-xs font-semibold text-[#0F172A]">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs text-[#475569] leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
