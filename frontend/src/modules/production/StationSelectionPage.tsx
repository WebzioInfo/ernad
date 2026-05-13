import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wind, PackageOpen, Zap, Box, 
  ArrowLeft, Loader2, Activity,
  ChevronRight, Shield
} from 'lucide-react';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export default function StationSelectionPage() {
  const { id: lineId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const line = location.state?.line;

  const { data: lineData, isLoading: isLoadingLine } = useQuery({
    queryKey: ['line', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINE(lineId!))).data,
    enabled: !line && !!lineId,
    retry: 1
  });

  const currentLine = line || lineData;

  const { data: activeSessions } = useQuery({
    queryKey: ['all-active-sessions'],
    queryFn: async () => (await api.get(ENDPOINTS.OPERATOR_SESSIONS.ACTIVE)).data,
    refetchInterval: 10000
  });

  const startSessionMutation = useMutation({
    mutationFn: (data: { lineId: string, station: string }) => api.post(ENDPOINTS.OPERATOR_SESSIONS.START, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      queryClient.invalidateQueries({ queryKey: ['line', lineId] });
      navigate(`/operator/workspace/${res.data.lineId}/${res.data.station.toLowerCase()}`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || 'Conflict detected. Session may be active elsewhere.';
      toast.error(message);
      queryClient.invalidateQueries({ queryKey: ['all-active-sessions'] });
    }
  });

  const stations = [
    { 
      id: 'BLOWING', 
      title: 'Blowing', 
      description: 'Preform heating and bottle blowing process.',
      icon: Wind, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      border: 'border-blue-100'
    },
    { 
      id: 'FILLING', 
      title: 'Filling', 
      description: 'Rinsing, filling and capping operation.',
      icon: PackageOpen, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      border: 'border-emerald-100'
    },
    { 
      id: 'LABELING', 
      title: 'Labeling', 
      description: 'Label application and date coding.',
      icon: Zap, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50',
      border: 'border-indigo-100'
    },
    { 
      id: 'PACKING', 
      title: 'Packing', 
      description: 'Final packaging and palletizing.',
      icon: Box, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      border: 'border-amber-100'
    },
  ];

  if (isLoadingLine) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Identifying Workstation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 md:p-20 relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)`, backgroundSize: '40px 40px' }}
      />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 blur-[120px] rounded-full" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              onClick={() => navigate('/operator/select')}
              className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-colors font-black uppercase tracking-[0.2em] text-[10px] mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Line Select
            </button>
            <h1 className="text-5xl font-black tracking-tighter uppercase">
              Select <span className="text-indigo-600">Station</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-4 flex items-center gap-3">
              <Shield className="w-4 h-4 text-indigo-600" />
              Active Unit: <span className="text-slate-900">{currentLine?.name || lineId}</span>
            </p>
          </motion.div>

          <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-3xl shadow-sm backdrop-blur-xl">
             <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-600" />
             </div>
             <div className="pr-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Line Status</p>
                <p className="text-sm font-black text-emerald-600 uppercase tracking-tight">{currentLine?.status || 'ONLINE'}</p>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <AnimatePresence mode="popLayout">
            {stations.map((station, idx) => {
              const occupant = activeSessions?.find((s: any) => s.lineId === lineId && s.station === station.id);
              const isStarting = startSessionMutation.isPending && selectedStation === station.id;

              return (
                <motion.button
                  key={station.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    setSelectedStation(station.id);
                    startSessionMutation.mutate({ lineId: lineId!, station: station.id });
                  }}
                  disabled={isStarting}
                  className={cn(
                    "group p-10 rounded-[3rem] border text-left relative overflow-hidden transition-all duration-500 flex flex-col justify-between h-[320px]",
                    occupant 
                      ? "bg-rose-50 border-rose-100" 
                      : "bg-white border-slate-200 hover:border-indigo-300 hover:-translate-y-2 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5"
                  )}
                >
                  <div className="relative z-10">
                    <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 duration-500 border", station.bg, station.border)}>
                      <station.icon className={cn("w-10 h-10", station.color)} />
                    </div>
                    <h3 className="text-3xl font-black tracking-tight uppercase text-slate-900">{station.title}</h3>
                    <p className="text-slate-500 font-bold text-xs mt-3 leading-relaxed max-w-[240px]">
                      {station.description}
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center justify-between mt-8">
                    {occupant ? (
                       <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Occupied: {occupant.userName}</span>
                       </div>
                    ) : (
                       <div className="flex items-center gap-3 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Initialize Workspace</span>
                          <ChevronRight className="w-4 h-4" />
                       </div>
                    )}
                    
                    {isStarting && <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />}
                  </div>

                  {/* Aesthetic Corner Glow */}
                  <div className={cn(
                    "absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity duration-700",
                    station.bg.replace('50', '200')
                  )} />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <footer className="mt-20 pt-10 border-t border-slate-200 flex justify-between items-center">
           <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Security Encrypted • Industrial Handshake Nominal</p>
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Protocol v2.4</span>
           </div>
        </footer>
      </div>
    </div>
  );
}
