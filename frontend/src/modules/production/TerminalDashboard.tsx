import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor,
  User,
  Zap,
  AlertCircle,
  Package,
  Clock,
  Activity,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Settings,
  Cpu,
  Target,
  TrendingUp,
  History
} from 'lucide-react';
import { api } from '../../services/api-client';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../auth/auth.store';
import { TerminalLogin } from './components/TerminalLogin';
import { motion } from 'framer-motion';

export default function TerminalDashboard() {
  const { user } = useAuthStore();
  const isManager = user?.role?.toUpperCase() === 'MANAGER';
  const [showLogin, setShowLogin] = useState(false);
  const [manualSelection, setManualSelection] = useState<{ lineId: string; station: string; lineName: string } | null>(null);

  const terminalCode = new URLSearchParams(window.location.search).get('terminal');

  const { data: terminal, isLoading: isLoadingTerminal } = useQuery({
    queryKey: ['terminal-state', terminalCode],
    queryFn: async () => (await api.get(ENDPOINTS.TERMINALS.STATE(terminalCode!))).data,
    enabled: !!terminalCode,
    retry: 1
  });

  const { data: allLines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data,
    enabled: !terminalCode && !manualSelection
  });

  const currentLineId = terminal?.lineId || manualSelection?.lineId;
  const currentStation = terminal?.department || manualSelection?.station;
  const currentLineName = terminal?.lineName || manualSelection?.lineName;

  const { data: batchData } = useQuery({
    queryKey: ['active-batch', currentLineId],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.ACTIVE_BATCH(currentLineId!))).data,
    enabled: !!currentLineId,
    refetchInterval: 10000,
    retry: 1
  });
  
  const lineData = useQuery({
    queryKey: ['line', currentLineId],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINE(currentLineId!))).data,
    enabled: !!currentLineId,
    retry: 1
  }).data;

  const activeBatch = batchData?.batch || lineData?.batch;

  const stations = [
    { id: 'BLOWING', title: 'Blowing', icon: Wind, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'FILLING', title: 'Filling', icon: PackageOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { id: 'LABELING', title: 'Labeling', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { id: 'PACKING', title: 'Packing', icon: Box, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ];

  if (!terminalCode && !manualSelection) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 md:p-20 relative overflow-hidden font-sans">
        <div className="fixed inset-0 pointer-events-none opacity-[0.05]"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)`, backgroundSize: '40px 40px' }}
        />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <header className="mb-20">
            <h1 className="text-5xl font-black tracking-tighter uppercase">Factory <span className="text-indigo-600">Overview</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-4 flex items-center gap-3">
              <Activity className="w-4 h-4 text-indigo-600" />
              Real-time Production Monitoring
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {allLines?.map((line: any) => (
              <div key={line.id} className="bg-white border border-slate-200 p-10 rounded-[3rem] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group flex flex-col justify-between h-[420px]">
                <div>
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 group-hover:bg-indigo-600 transition-colors">
                      <Cpu className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                    </div>
                    <div className={cn(
                      "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      line.status === 'RUNNING' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}>
                      {line.status}
                    </div>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase mb-4">{line.name}</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Select station for remote view</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  {stations.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setManualSelection({ lineId: line.id, station: s.id, lineName: line.name })}
                      className="py-4 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-700 transition-all"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingTerminal && terminalCode) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <Activity className="animate-spin w-12 h-12 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans relative">
       {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)`, backgroundSize: '40px 40px' }}
      />

      <header className="px-10 py-6 bg-white/80 border-b border-slate-200 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">
              {terminal?.name || `${currentStation} - ${currentLineName}`}
            </h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {currentStation} • {currentLineName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <button
            onClick={() => setManualSelection(null)}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 transition-all border border-slate-200"
          >
            <Settings className="w-3.5 h-3.5" /> Switch Unit
          </button>
          <div className="flex items-center gap-4 border-l border-slate-100 pl-10">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Terminal Code</span>
              <span className="text-xs font-mono font-bold text-slate-600">{terminal?.code || 'P-001'}</span>
            </div>
            <div className={cn(
              "w-2.5 h-2.5 rounded-full shadow-lg",
              (terminal?.status === 'ONLINE' || manualSelection) ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
            )} />
          </div>
        </div>
      </header>

      <main className="flex-1 p-10 max-w-[1800px] mx-auto w-full grid grid-cols-12 gap-10 relative z-10">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-10">
          <section className="bg-white border border-slate-200 rounded-[3rem] p-12 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/50 blur-[100px] -mr-40 -mt-40 pointer-events-none" />
             
             <div className="flex justify-between items-start mb-16 relative z-10">
               <div>
                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-3">Active Production Stream</span>
                 <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tight mb-2">
                   {activeBatch?.productName || 'SYSTEM_IDLE'}
                 </h2>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                   Batch: <span className="text-slate-900">{activeBatch?.batchCode || '---'}</span>
                 </p>
               </div>
               <div className="px-6 py-2.5 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-black text-emerald-600 uppercase tracking-widest">
                 {activeBatch?.status || 'STANDBY'}
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative z-10">
               <div className="p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col justify-between h-[280px]">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                      <Target className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Yield</span>
                 </div>
                 <p className="text-6xl font-black text-slate-900 tracking-tighter italic">{(activeBatch?.target || 0).toLocaleString()}</p>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Units</div>
               </div>

               <div className="p-10 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] flex flex-col justify-between h-[280px]">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-indigo-100 shadow-sm">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Achieved</span>
                 </div>
                 <p className="text-6xl font-black text-indigo-600 tracking-tighter italic">{(activeBatch?.actual || 0).toLocaleString()}</p>
                 <div className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">{((activeBatch?.actual / activeBatch?.target) * 100).toFixed(1)}% Efficiency</div>
               </div>

               <div className="p-10 bg-white border border-slate-100 rounded-[2.5rem] flex flex-col justify-between h-[280px] shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <Activity className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</span>
                 </div>
                 <p className="text-6xl font-black text-slate-900 tracking-tighter italic">{(activeBatch?.target - activeBatch?.actual || 0).toLocaleString()}</p>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Remaining Workload</div>
               </div>
             </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-10">
          <section className="bg-white border border-slate-200 rounded-[3rem] p-10 flex-1 shadow-sm flex flex-col overflow-hidden">
             <div className="flex items-center gap-4 mb-10">
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                   <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-tight">Timeline Feed</h3>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Real-time Data Ingress</p>
                </div>
             </div>
             
             <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20">
                <History size={64} className="text-slate-200 mb-6" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Waiting for Stream...</p>
             </div>
          </section>

          <div className="bg-indigo-600 border border-indigo-700 rounded-[2.5rem] p-10 flex items-center justify-between shadow-xl shadow-indigo-100 group">
             <div>
                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em] mb-2">Remote Node Monitor</p>
                <p className="text-xs font-bold text-white">System v4.2.1 • Operational</p>
             </div>
             <ShieldCheck className="w-8 h-8 text-white/50 group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </main>

      <footer className="px-10 py-10 bg-white border-t border-slate-200 flex justify-between items-center relative z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uplink Confirmed</span>
          </div>
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-4 h-4 text-slate-300" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure Industrial Stream</span>
          </div>
        </div>
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">ERNAD_CORE_MFG</p>
      </footer>
    </div>
  );
}
