import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowLeft, Loader2, CheckCircle2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface TerminalLoginProps {
  onSuccess: (operator: any) => void;
  onClose: () => void;
  lineName?: string;
  lineId?: string;
}

export function TerminalLogin({ onSuccess, onClose, lineName, lineId }: TerminalLoginProps) {
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto-fetch operators for this line if not provided
  const { data: operators, isLoading } = useQuery({
    queryKey: ['line-operators', lineId],
    queryFn: async () => (await api.get('/users/terminal-list')).data,
  });

  const handlePinPress = (num: string) => {
    if (pin.length < 6) setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleVerify = async () => {
    if (pin.length < 4) return;
    
    setIsVerifying(true);
    try {
      await api.post('/production-telemetry/verify-operator', {
        operatorId: selectedOperator.id,
        pin: pin
      });
      
      toast.success(`Welcome, ${selectedOperator.name}`);
      onSuccess(selectedOperator);
    } catch (err: any) {
      toast.error('Invalid PIN. Access Denied.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-[#111] border border-white/10 rounded-[3rem] w-full max-w-4xl h-[80vh] flex flex-col relative overflow-hidden shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 w-12 h-12 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-2xl flex items-center justify-center transition-all z-50"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex-1 p-16 overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
          ) : !selectedOperator ? (
            <div className="flex flex-col h-full">
              <div className="mb-12">
                <h2 className="text-5xl font-black text-white uppercase tracking-tight italic">Who are you?</h2>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-3">Active Unit: {lineName || 'Registered Factory Line'}</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {operators?.map((op: any) => (
                  <motion.button
                    key={op.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedOperator(op)}
                    className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col items-center gap-6 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"
                  >
                    <div className="w-20 h-20 rounded-[1.5rem] bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
                      {op.avatarUrl ? (
                        <img src={op.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-indigo-400" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{op.name}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{op.jobTitle || 'Industrial Operator'}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full max-w-md mx-auto w-full justify-center">
              <button 
                onClick={() => { setSelectedOperator(null); setPin(''); }}
                className="flex items-center gap-3 text-slate-500 hover:text-white transition-colors mb-12 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-2 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest italic">Back to Team Selection</span>
              </button>

              <div className="flex flex-col items-center mb-12">
                <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center mb-6 overflow-hidden">
                  {selectedOperator.avatarUrl ? (
                    <img src={selectedOperator.avatarUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-12 h-12 text-indigo-400" />
                  )}
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tight italic">{selectedOperator.name}</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-3">Identify with Security PIN</p>
              </div>

              <div className="flex justify-center gap-4 mb-16">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                      pin.length > i ? 'bg-indigo-500 border-indigo-400 scale-125 shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'border-white/10'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinPress(num.toString())}
                    className="h-20 bg-white/5 border border-white/10 rounded-2xl text-3xl font-black hover:bg-white/10 active:scale-90 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-20 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white active:scale-90 transition-all flex items-center justify-center"
                >
                  <ArrowLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePinPress('0')}
                  className="h-20 bg-white/5 border border-white/10 rounded-2xl text-3xl font-black hover:bg-white/10 active:scale-90 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || pin.length < 4}
                  className="h-20 bg-indigo-600 border border-indigo-500 rounded-2xl text-white hover:bg-indigo-500 active:scale-90 transition-all flex items-center justify-center disabled:opacity-50 disabled:grayscale"
                >
                  {isVerifying ? <Loader2 className="w-8 h-8 animate-spin" /> : <CheckCircle2 className="w-8 h-8" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
