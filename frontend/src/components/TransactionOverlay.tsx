import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type OverlayState = 'idle' | 'processing' | 'success' | 'error';

interface OverlayContextType {
  startProcessing: (message?: string) => void;
  showSuccess: (message?: string, duration?: number) => Promise<void>;
  showError: (message?: string) => void;
  close: () => void;
  isLocked: boolean;
}

const TransactionOverlayContext = createContext<OverlayContextType | undefined>(undefined);

export function useTransactionOverlay() {
  const context = useContext(TransactionOverlayContext);
  if (!context) {
    throw new Error('useTransactionOverlay must be used within a TransactionOverlayProvider');
  }
  return context;
}

export function TransactionOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OverlayState>('idle');
  const [message, setMessage] = useState<string>('');

  const startProcessing = (msg = 'Processing Data...') => {
    setMessage(msg);
    setState('processing');
  };

  const showSuccess = (msg = 'Saved Successfully', duration = 2000): Promise<void> => {
    return new Promise((resolve) => {
      setMessage(msg);
      setState('success');
      setTimeout(() => {
        setState('idle');
        resolve();
      }, duration);
    });
  };

  const showError = (msg = 'Save Failed') => {
    setMessage(msg);
    setState('error');
    // Error state allows user to close it manually so data is kept
  };

  const close = () => {
    setState('idle');
  };

  const isLocked = state !== 'idle' && state !== 'error';

  return (
    <TransactionOverlayContext.Provider value={{ startProcessing, showSuccess, showError, close, isLocked }}>
      {children}
      
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // z-[9999] guarantees it blocks absolutely everything
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center"
            >
              {state === 'processing' && (
                <>
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{message}</h2>
                  <p className="text-sm font-bold text-slate-500">Please wait. Do not close this page.</p>
                </>
              )}

              {state === 'success' && (
                <>
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{message}</h2>
                  <p className="text-sm font-bold text-slate-500">Transaction recorded</p>
                </>
              )}

              {state === 'error' && (
                <>
                  <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <XCircle className="w-12 h-12" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{message}</h2>
                  <p className="text-sm font-bold text-slate-500 mb-6">No data was saved. Please try again.</p>
                  <button
                    onClick={close}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TransactionOverlayContext.Provider>
  );
}
