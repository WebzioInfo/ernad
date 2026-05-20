import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowLeft, Loader2, CheckCircle2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ENDPOINTS } from '../../../constants/endpoints';
import useAuthStore from '../../auth/auth.store';

interface TerminalLoginProps {
  onSuccess: (operator: any) => void;
  onClose: () => void;
  lineName?: string;
  lineId?: string;
  station?: string;
  terminalId?: string;
}

export function TerminalLogin({ onSuccess, onClose, lineName, lineId, station, terminalId }: TerminalLoginProps) {
  const navigate = useNavigate();
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);

  // Auto-fetch operators for this line if not provided
  const { data: operators, isLoading } = useQuery({
    queryKey: ['line-operators', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.TERMINALS.OPERATORS)).data,
  });

  const handlePinPress = (num: string) => {
    if (pin.length < 4) setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleVerify = async () => {
    if (pin.length < 4) return;
    
    // PRE-FLIGHT VALIDATION: Ensure terminal context is provided
    if (!lineId || !station) {
      toast.error('CONFIGURATION_ERROR: No production line or station selected.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await api.post(ENDPOINTS.TERMINALS.AUTH_LOGIN, {
        operatorId: selectedOperator.id,
        pin: pin,
        lineId: lineId,
        station: station,
        terminalId: terminalId,
      });
      
      const { access_token, user, session } = response.data;
      
      // PERSIST INDUSTRIAL IDENTITY
      setAuth(access_token, user);
      
      toast.success(`Welcome, ${selectedOperator.name}`);
      onSuccess({ ...selectedOperator, currentPin: pin, sessionId: session?.id || user?.sessionId });
      
      // Navigate to Operator Panel
      navigate(`/line/${lineId}/${station?.toLowerCase() || 'filling'}/operator`);
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Authentication failure';

      console.error(`[AUTH_ERROR] Status: ${status} | Message: ${message}`);

      if (status === 400) {
        toast.error(`Configuration Error: ${message}`);
      } else if (status === 401) {
        toast.error('Access Denied: Invalid Security PIN');
      } else if (status === 404) {
        toast.error('Identity Error: Operator profile not found');
      } else if (status === 409) {
        if (message.includes('Operator already has an active session')) {
          toast.error('Session Conflict: You already have an active session running on another station. Please log out there first.');
        } else {
          toast.error('Conflict: Station occupied by another operator');
        }
      } else if (status === 503 || err.code === 'ECONNABORTED') {
        toast.error('Connectivity Error: Terminal is offline');
      } else {
        toast.error(`System Error: ${message}`);
      }

      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };


  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-4xl h-full sm:h-[80vh] max-h-[900px] flex flex-col relative overflow-hidden shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 sm:top-8 right-4 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all z-50"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="flex-1 p-6 sm:p-16 overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
          ) : !selectedOperator ? (
            <div className="flex flex-col h-full">
              <div className="mb-8 sm:mb-12">
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 uppercase tracking-tight">Who are you?</h2>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs mt-3">Active Unit: {lineName || 'Registered Factory Line'}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {operators?.map((op: any) => (
                  <motion.button
                    key={op.id}
                    whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedOperator(op)}
                    className="p-6 sm:p-8 bg-white border border-slate-100 rounded-[2rem] sm:rounded-[2.5rem] flex flex-col items-center gap-4 sm:gap-6 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.2rem] sm:rounded-[1.8rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                      {op.avatarUrl ? (
                        <img src={op.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-black text-slate-900">{op.name}</p>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{op.jobTitle || 'Industrial Operator'}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full max-w-md mx-auto w-full justify-center">
              <button 
                onClick={() => { setSelectedOperator(null); setPin(''); }}
                className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-colors mb-8 sm:mb-12 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-2 transition-transform" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Back to Team Selection</span>
              </button>

              <div className="flex flex-col items-center mb-8 sm:mb-12">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] sm:rounded-[2rem] bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center mb-4 sm:mb-6 overflow-hidden shrink-0">
                  {selectedOperator.avatarUrl ? (
                    <img src={selectedOperator.avatarUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-600" />
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">{selectedOperator.name}</h3>
                <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mt-2 sm:mt-3 text-center">Identify with Security PIN</p>
              </div>

              <div className="flex justify-center gap-3 sm:gap-4 mb-10 sm:mb-16">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-300 ${
                      pin.length > i ? 'bg-indigo-600 border-indigo-500 scale-125 shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'border-slate-200'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinPress(num.toString())}
                    className="h-16 sm:h-20 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl text-2xl sm:text-3xl font-black text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-16 sm:h-20 bg-rose-50 border border-rose-100 rounded-xl sm:rounded-2xl text-rose-600 hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  <ArrowLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePinPress('0')}
                  className="h-16 sm:h-20 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl text-2xl sm:text-3xl font-black text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || pin.length < 4}
                  className="h-16 sm:h-20 bg-indigo-600 border border-indigo-700 rounded-xl sm:rounded-2xl text-white hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:grayscale shadow-lg shadow-indigo-200"
                >
                  {isVerifying ? <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" /> : <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
,
    document.body
  );
}
