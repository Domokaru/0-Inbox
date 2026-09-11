import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DestructiveConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemDetails?: {
    sender?: string;
    subject?: string;
  };
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDarkTheme?: boolean;
}

export default function DestructiveConfirmModal({
  isOpen,
  title,
  description,
  itemDetails,
  confirmLabel = 'Move to Trash',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDarkTheme = true,
}: DestructiveConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.16 }}
          className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
            isDarkTheme
              ? 'bg-[#181824] text-white border-[#2E2E44]'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight text-red-500">{title}</h3>
                <span className="text-[11px] text-gray-400 font-medium">Google Workspace Action</span>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className={`text-xs leading-relaxed mb-3 ${isDarkTheme ? 'text-gray-300' : 'text-slate-600'}`}>
            {description}
          </p>

          {itemDetails && (
            <div
              className={`p-3 rounded-2xl border text-xs mb-5 ${
                isDarkTheme ? 'bg-[#111118] border-[#252538]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400 mb-1">
                Target Email
              </div>
              {itemDetails.sender && (
                <div className="font-semibold text-emerald-400 truncate text-[11px]">
                  {itemDetails.sender}
                </div>
              )}
              {itemDetails.subject && (
                <div className={`font-bold truncate mt-0.5 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                  {itemDetails.subject}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all ${
                isDarkTheme
                  ? 'border-[#383850] text-gray-300 hover:bg-[#252538] hover:text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>{confirmLabel}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
