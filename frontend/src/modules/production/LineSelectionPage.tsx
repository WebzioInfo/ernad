import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import {
  Cpu, ArrowRight, Loader2,
  Activity, ShieldCheck, LogOut,
  Wind, PackageOpen, Zap, Box, ArrowLeft
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { toast } from 'sonner';

export default function LineSelectionPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'line' | 'station'>('line');
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const { data: currentSession, isLoading: isLoadingSession } = useQuery({
    queryKey: ['current-operator-session'],
    queryFn: async () => (await api.get('/operator/session/current')).data,
  });

  const { data: recentSessions } = useQuery({
    queryKey: ['recent-operator-sessions'],
    queryFn: async () => (await api.get('/operator/session/recent')).data,
  });

  const { data: activeSessions } = useQuery({
    queryKey: ['all-active-sessions'],
    queryFn: async () => (await api.get('/operator/session/all-active')).data, // I'll need to add this endpoint
    refetchInterval: 10000
  });

  const { data: lines, isLoading: isLoadingLines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  const startSessionMutation = useMutation({
    mutationFn: (data: { lineId: string, station: string, force?: boolean }) => api.post('/operator/session/start', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      navigate(`/line/${res.data.lineId}/operator`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || 'Failed to start session';
      if (message.includes('occupied')) {
        toast.error('Station is currently occupied by another operator.');
      } else {
        toast.error(message);
      }
    }
  });

  // If already has session, redirect
  if (currentSession) {
    navigate(`/line/${currentSession.lineId}/operator`);
    return null;
  }

  const isLoading = isLoadingLines || isLoadingSession;

  if (isLoading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
      <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      <p className="font-black uppercase tracking-widest text-[10px] text-slate-500">Initializing Factory Grid...</p>
    </div>
  );

  const stations = [
    { id: 'BLOWING', title: 'Blowing', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'FILLING', title: 'Filling', icon: PackageOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'LABELING', title: 'Labeling', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'PACKING', title: 'Packing', icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 md:p-20 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-20">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2">Select Production Line</h1>
            <p className="text-slate-500 font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Identify your current workstation to begin logging.
            </p>
          </div>
          <div className="flex items-center gap-6 bg-white/5 p-4 rounded-[2rem] border border-white/10">
            <div className="text-right">
              <p className="text-sm font-black">{user?.name}</p>
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{user?.roles?.[0]?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-4 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all active:scale-90"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid */}
        {step === 'line' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lines?.map((line: any) => (
              <button
                key={line.id}
                onClick={() => { setSelectedLine(line); setStep('station'); }}
                className="group bg-white/5 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-blue-600 hover:border-blue-500 hover:-translate-y-2 transition-all duration-500 relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-white/20 transition-colors">
                    <Cpu className="w-8 h-8 text-blue-400 group-hover:text-white" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight mb-2 group-hover:text-white">{line.name}</h3>
                  <p className="text-slate-500 font-medium group-hover:text-blue-100 mb-8">{line.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-full border border-white/5">
                      <div className={`w-2 h-2 rounded-full ${line.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{line.status}</span>
                    </div>
                    <ArrowRight className="w-6 h-6 text-slate-700 group-hover:text-white group-hover:translate-x-2 transition-all" />
                  </div>
                </div>

                {/* Background Glow */}
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}

            {/* Maintenance Card */}
            <div className="bg-slate-800/50 border border-dashed border-white/10 p-10 rounded-[3rem] flex flex-col items-center justify-center text-center opacity-50">
              <ShieldCheck className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-sm font-bold text-slate-500">Additional lines offline or under maintenance.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
             <button 
               onClick={() => setStep('line')}
               className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors font-black uppercase tracking-widest text-[10px]"
             >
               <ArrowLeft className="w-4 h-4" /> Back to Line Selection
             </button>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
               {stations.map(station => {
                 const occupant = activeSessions?.find((s:any) => s.lineId === selectedLine.id && s.station === station.id);
                 return (
                   <button
                     key={station.id}
                     onClick={() => setSelectedStation(station.id)}
                     className={`group p-10 rounded-[3rem] border transition-all duration-300 text-left relative overflow-hidden ${
                       selectedStation === station.id 
                         ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-500/20 scale-[1.02]' 
                         : 'bg-white/5 border-white/10 hover:bg-white/10'
                     }`}
                   >
                     <div className="relative z-10">
                       <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-8 ${
                         selectedStation === station.id ? 'bg-white/20' : station.bg
                       }`}>
                         <station.icon className={`w-8 h-8 ${selectedStation === station.id ? 'text-white' : station.color}`} />
                       </div>
                       <h3 className="text-3xl font-black tracking-tight mb-2">{station.title}</h3>
                       {occupant ? (
                         <div className="flex items-center gap-2 mt-4">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Occupied: {occupant.userName || 'Another Operator'}</p>
                         </div>
                       ) : (
                         <p className={`text-sm font-bold ${selectedStation === station.id ? 'text-blue-100' : 'text-slate-500'}`}>
                           Operational unit for {station.title.toLowerCase()} process.
                         </p>
                       )}
                     </div>
                   </button>
                 );
               })}
             </div>

             <div className="flex flex-col items-center mt-12 gap-6">
                <button 
                  disabled={!selectedStation || startSessionMutation.isPending}
                  onClick={() => startSessionMutation.mutate({ lineId: selectedLine.id, station: selectedStation! })}
                  className="px-20 py-8 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-sm shadow-2xl shadow-blue-500/40 transition-all active:scale-95 flex items-center gap-4"
                >
                  {startSessionMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
                  {activeSessions?.find((s:any) => s.lineId === selectedLine.id && s.station === selectedStation)?.id ? 'Force Takeover' : 'Establish Production Session'}
                </button>

                {recentSessions?.length > 0 && !selectedStation && (
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Quick Resume</p>
                    <div className="flex gap-4">
                       {recentSessions.slice(0, 2).map((s:any) => (
                         <button 
                           key={s.id}
                           onClick={() => startSessionMutation.mutate({ lineId: s.lineId, station: s.station, force: true })}
                           className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                         >
                           {s.lineName || 'Line'} - {s.station}
                         </button>
                       ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Ernad v2.0 • Industrial MES Grid</span>
      </div>
    </div>
  );
}
