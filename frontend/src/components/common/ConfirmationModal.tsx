import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white',
    info: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 text-white',
    primary: 'bg-[#1A9A91] hover:bg-[#157C75] shadow-[#1A9A91]/20 text-white'
  };

  const iconColors = {
    danger: 'text-rose-600 bg-rose-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-indigo-600 bg-indigo-50',
    primary: 'text-[#1A9A91] bg-[#1A9A91]/10'
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconColors[variant]}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{title}</h3>
          <p className="text-slate-500 font-medium leading-relaxed">{message}</p>

          <div className="mt-10 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 ${colors[variant]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
