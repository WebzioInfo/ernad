import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import {
  Cpu, ArrowRight, Loader2,
  Activity, ShieldCheck, LogOut,
  Wind, PackageOpen, Zap, Box, ArrowLeft,
  User
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../constants/endpoints';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function LineSelectionPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'line' | 'station'>('line');
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const { data: currentSession, isLoading: isLoadingSession } = useQuery({
    queryKey: ['current-operator-session'],
    queryFn: async () => (await api.get(ENDPOINTS.OPERATOR_SESSIONS.CURRENT)).data,
  });

  const { data: activeSessions } = useQuery({
    queryKey: ['all-active-sessions'],
    queryFn: async () => (await api.get(ENDPOINTS.OPERATOR_SESSIONS.ACTIVE)).data,
    refetchInterval: 10000
  });

  const { data: lines, isLoading: isLoadingLines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data
  });

  const startSessionMutation = useMutation({
    mutationFn: (data: { lineId: string, station: string, force?: boolean }) => api.post(ENDPOINTS.OPERATOR_SESSIONS.START, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      navigate(`/operator/workspace/${res.data.lineId}/${res.data.station.toLowerCase()}`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || 'Failed to start session';
      toast.error(message);
    }
  });

  useEffect(() => {
    // Only auto-navigate if the user IS an operator. Managers might want to select a different line.
    const isOperator = user?.roles?.some((r: any) => r.toUpperCase() === 'OPERATOR') || user?.role?.toUpperCase() === 'OPERATOR';
    
    if (currentSession && !isLoadingSession && isOperator) {
      navigate(`/operator/workspace/${currentSession.lineId}/${currentSession.station.toLowerCase()}`, { replace: true });
    }
  }, [currentSession, isLoadingSession, navigate, user]);

  const isLoading = isLoadingLines || isLoadingSession;

  if (isLoading) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-6">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Initializing Factory Grid...</p>
    </div>
  );

  const stations = [
    { id: 'BLOWING', title: 'Blowing', icon: Wind, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'FILLING', title: 'Filling', icon: PackageOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { id: 'LABELING', title: 'Labeling', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { id: 'PACKING', title: 'Packing', icon: Box, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 md:p-20 font-sans relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)`, backgroundSize: '40px 40px' }}
      />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-20">
          <div>
            <h1 className="text-5xl font-black tracking-tighter uppercase">Factory <span className="text-indigo-600">Portal</span></h1>
            <p className="text-slate-500 font-bold flex items-center gap-2 mt-4 uppercase tracking-widest text-xs">
              <Activity className="w-4 h-4 text-indigo-600" />
              Production Workspace Initialization
            </p>
          </div>
          <div className="flex items-center gap-6 bg-white border border-slate-200 p-4 rounded-[2rem] shadow-sm">
            <div className="text-right">
              <p className="text-sm font-black text-slate-900">{user?.name}</p>
              <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{user?.roles?.[0]?.replace('_', ' ')}</p>
            </div>
            <button onClick={() => logout()} className="p-4 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all border border-slate-100">
               <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {step === 'line' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {lines?.map((line: any) => (
              <button
                key={line.id}
                onClick={() => { 
                  setSelectedLine(line); 
                  setStep('station');
                  // Pre-invalidate to ensure fresh data for next step
                  queryClient.invalidateQueries({ queryKey: ['line', line.id] });
                }}
                className="group bg-white border border-slate-200 p-10 rounded-[3rem] text-left hover:border-indigo-300 hover:-translate-y-2 transition-all shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col h-[320px] justify-between relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                    <Cpu className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase text-slate-900 leading-none mb-2">{line.name}</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">{line.department || 'Production Unit'}</p>
                </div>

                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active Grid</span>
                  </div>
                  <ArrowRight className="w-6 h-6 text-indigo-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                </div>
                
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-50 rounded-full blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
              </button>
            ))}

            <div className="bg-slate-50 border border-dashed border-slate-200 p-10 rounded-[3rem] flex flex-col items-center justify-center text-center opacity-60">
              <ShieldCheck className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Additional units offline</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
            <button
              onClick={() => setStep('line')}
              className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-colors font-black uppercase tracking-widest text-[10px] group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Line Selection
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {stations.map(station => {
                const occupant = activeSessions?.find((s: any) => s.lineId === selectedLine.id && s.station === station.id);
                const isMySession = occupant && occupant.userId === user?.id;
                const isStarting = startSessionMutation.isPending && selectedStation === station.id;

                return (
                  <div
                    key={station.id}
                    className={cn(
                      "group p-10 rounded-[3rem] border transition-all duration-300 text-left relative overflow-hidden flex flex-col justify-between h-[340px]",
                      occupant 
                        ? (isMySession ? 'bg-indigo-50 border-indigo-100' : 'bg-rose-50 border-rose-100') 
                        : 'bg-white border-slate-200'
                    )}
                  >
                    <div className="relative z-10">
                      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border", station.bg, station.border)}>
                        <station.icon className={cn("w-8 h-8", station.color)} />
                      </div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase text-slate-900 leading-none mb-3">{station.title}</h3>
                      {occupant ? (
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isMySession ? "bg-indigo-500" : "bg-rose-500")} />
                          <p className={cn("text-[9px] font-black uppercase tracking-widest", isMySession ? "text-indigo-600" : "text-rose-600")}>
                            {isMySession ? 'Your Active Session' : `Occupied: ${occupant.userName}`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          Initialize {station.title.toLowerCase()} process node
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedStation(station.id);
                        startSessionMutation.mutate({ 
                          lineId: selectedLine.id, 
                          station: station.id,
                          force: occupant && !isMySession // Only force if it's someone else
                        });
                      }}
                      disabled={isStarting}
                      className={cn(
                        "mt-auto w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-sm",
                        occupant
                          ? (isMySession 
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100' 
                              : 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white')
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                      )}
                    >
                      {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : (occupant ? (isMySession ? <Activity className="w-4 h-4" /> : <Zap className="w-4 h-4" />) : <Activity className="w-4 h-4" />)}
                      {occupant ? (isMySession ? 'Resume Session' : 'Force Takeover') : 'Start Session'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-full shadow-lg">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Ernad • Industrial MES Grid v2.5</span>
      </footer>
    </div>
  );
}
