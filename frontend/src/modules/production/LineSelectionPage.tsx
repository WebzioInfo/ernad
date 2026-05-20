import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import {
  Cpu, ArrowRight, Loader2,
  Activity, ShieldCheck, LogOut,
  Wind, PackageOpen, Zap, Box, ArrowLeft
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../constants/endpoints';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export default function LineSelectionPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'line' | 'station'>('line');
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [takeoverPayload, setTakeoverPayload] = useState<any>(null);

  // Session checks removed to enforce manual station selection

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
    mutationFn: (data: { lineId: string, station: string, force?: boolean, supervisorPin?: string }) => api.post(ENDPOINTS.OPERATOR_SESSIONS.START, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      setShowSupervisorModal(false);
      setSupervisorPin('');
      navigate(`/operator/workspace/${res.data.lineId}/${res.data.station.toLowerCase()}`);
    },
    onError: (err: any) => {
      const errorData = err.response?.data;
      if (errorData?.code === 'SUPERVISOR_OVERRIDE_REQUIRED') {
        setTakeoverPayload({ 
          lineId: selectedLine?.id, 
          station: selectedStation,
          ownerId: errorData.ownerId 
        });
        setShowSupervisorModal(true);
      } else {
        const message = errorData?.message || 'Failed to start session';
        toast.error(message);
      }
    }
  });


  const handleLineSelect = (line: any) => {
    setSelectedLine(line);
    
    // 1. Removed auto-navigate. Operator MUST manually select station.

    // 2. Transition to station selection step
    setStep('station');
    queryClient.invalidateQueries({ queryKey: ['line', line.id] });
  };

  // Removed automatic station navigation effect to enforce manual line and station selection.

  const isLoading = isLoadingLines || startSessionMutation.isPending;

  if (isLoading) return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-6">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
        {startSessionMutation.isPending ? 'Initializing workspace session...' : 'Initializing Factory Grid...'}
      </p>
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
            {lines?.filter((line: any) => line.status === 'RUNNING' || line.status === 'CHANGEOVER').map((line: any) => (
              <button
                key={line.id}
                onClick={() => handleLineSelect(line)}
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
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      line.status === 'RUNNING' ? 'bg-emerald-500' :
                      line.status === 'IDLE' ? 'bg-slate-400' :
                      line.status === 'BREAKDOWN' ? 'bg-rose-500' :
                      'bg-amber-500'
                    )} />
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      line.status === 'RUNNING' ? 'text-emerald-600' :
                      line.status === 'IDLE' ? 'text-slate-500' :
                      line.status === 'BREAKDOWN' ? 'text-rose-600' :
                      'text-amber-600'
                    )}>
                      {line.status || 'IDLE'}
                    </span>
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
                  <button
                    key={station.id}
                    onClick={() => {
                      if (isStarting) return;
                      setSelectedStation(station.id);
                      startSessionMutation.mutate({
                        lineId: selectedLine.id,
                        station: station.id,
                        force: occupant && !isMySession
                      });
                    }}
                    disabled={isStarting}
                    className={cn(
                      "group p-10 rounded-[3rem] border transition-all duration-300 text-left relative overflow-hidden flex flex-col justify-between h-[340px] w-full",
                      occupant
                        ? (isMySession ? 'bg-indigo-50 border-indigo-100' : 'bg-rose-50 border-rose-100')
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:-translate-y-2'
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

                    <div className="relative z-10 flex items-center justify-between w-full mt-auto">
                      {isStarting ? (
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      ) : occupant ? (
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isMySession ? "bg-indigo-500" : "bg-rose-500")} />
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", isMySession ? "text-indigo-600" : "text-rose-600")}>
                            {isMySession ? 'Resume Session' : 'Force Takeover'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Initialize Workspace
                        </span>
                      )}
                      <ArrowRight className="w-5 h-5 text-indigo-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>


      <Dialog open={showSupervisorModal} onOpenChange={setShowSupervisorModal}>
        <DialogContent className="sm:max-w-md bg-white rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader className="space-y-4">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100">
              <ShieldCheck className="w-8 h-8 text-rose-600" />
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase leading-none">Supervisor <span className="text-rose-600">Override</span> Required</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              This production line is currently active. A supervisor must authorize the takeover with their 4-digit security PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Security Authorization PIN</label>
            <Input
              type="password"
              maxLength={4}
              value={supervisorPin}
              onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-20 text-center text-4xl font-black tracking-[0.5em] bg-slate-50 border-slate-100 rounded-2xl focus:ring-rose-500 focus:border-rose-500 transition-all"
              placeholder="••••"
            />
          </div>
          <DialogFooter className="sm:justify-start gap-4">
            <Button
              type="button"
              className="flex-1 h-14 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => {
                if (supervisorPin.length === 4) {
                  startSessionMutation.mutate({
                    ...takeoverPayload,
                    supervisorPin
                  });
                } else {
                  toast.error('PIN must be 4 digits');
                }
              }}
              disabled={startSessionMutation.isPending}
            >
              {startSessionMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Takeover'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-2xl transition-all"
              onClick={() => setShowSupervisorModal(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
