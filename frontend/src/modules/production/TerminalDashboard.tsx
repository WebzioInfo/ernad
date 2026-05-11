import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Monitor, 
  User, 
  Settings, 
  Zap, 
  AlertCircle, 
  Package, 
  Clock, 
  Activity,
  LogOut,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api-client';
import { cn } from '../../lib/utils';
import { TerminalLogin } from './components/TerminalLogin';

export default function TerminalDashboard() {
  const [terminalId] = useState(() => localStorage.getItem('mes-terminal-id'));
  const [showLogin, setShowLogin] = useState(false);

  // 1. Fetch Terminal State
  const { data: terminal } = useQuery({
    queryKey: ['terminal-state', terminalId],
    queryFn: async () => (await api.get(`/production-management/terminal/${terminalId}`)).data,
    enabled: !!terminalId
  });

  // 2. Fetch Active Production Batch for this Line
  const { data: batchData } = useQuery({
    queryKey: ['active-batch', terminal?.lineId],
    queryFn: async () => (await api.get(`/production-batch/active/${terminal.lineId}`)).data,
    enabled: !!terminal?.lineId,
    refetchInterval: 10000 // High-frequency polling for terminal
  });

  const activeBatch = batchData?.batch;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden">
      {/* Industrial Header */}
      <header className="h-20 bg-black/40 border-b border-white/5 flex items-center justify-between px-10">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none">{terminal?.name || 'Terminal Offline'}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Station: {terminal?.department} • Line: {terminal?.lineName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Terminal ID</span>
            <span className="text-xs font-mono text-slate-400">{terminal?.code}</span>
          </div>
          <div className={cn(
            "w-3 h-3 rounded-full",
            terminal?.status === 'ONLINE' ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
          )} />
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-10 grid grid-cols-12 gap-8">
        
        {/* Left: Production Stats Card */}
        <div className="col-span-8 flex flex-col gap-8">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32" />
            
            <div className="flex justify-between items-start mb-12 relative z-10">
              <div>
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-2">Live Production Batch</span>
                <h2 className="text-5xl font-black text-white uppercase tracking-tight italic">
                  {activeBatch?.productName || 'No Active Batch'}
                </h2>
                <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">
                  Batch Code: {activeBatch?.batchCode || '---'}
                </p>
              </div>
              <div className="px-6 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-black text-emerald-500 uppercase tracking-widest">
                {activeBatch?.status || 'IDLE'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-10 flex-1 relative z-10">
              <div className="p-8 bg-black/40 border border-white/5 rounded-3xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shift Target</span>
                <p className="text-5xl font-black text-white">{(activeBatch?.target || 0).toLocaleString()}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase">
                  <Package className="w-3 h-3" /> Bottles
                </div>
              </div>
              <div className="p-8 bg-black/40 border border-white/5 rounded-3xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-emerald-500">Achieved</span>
                <p className="text-5xl font-black text-emerald-400">{(activeBatch?.actual || 0).toLocaleString()}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/50 uppercase">
                  <Activity className="w-3 h-3" /> Live Feed
                </div>
              </div>
              <div className="p-8 bg-black/40 border border-white/5 rounded-3xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-indigo-500">OEE Metric</span>
                <p className="text-5xl font-black text-indigo-400">{(activeBatch?.oee || 0).toFixed(1)}%</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500/50 uppercase">
                  <Zap className="w-3 h-3" /> High Performance
                </div>
              </div>
            </div>
          </div>

          <div className="h-40 grid grid-cols-2 gap-8">
            <button className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 flex items-center gap-6 hover:bg-amber-500/20 transition-all group">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <div className="text-left">
                <h4 className="text-xl font-black text-white uppercase italic">Report Stop</h4>
                <p className="text-xs font-bold text-amber-500/60 uppercase tracking-widest">Downtime / Machine Failure</p>
              </div>
            </button>
            <button className="bg-white/5 border border-white/10 rounded-[2rem] p-8 flex items-center gap-6 hover:bg-white/10 transition-all group">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Settings className="w-8 h-8 text-white/50" />
              </div>
              <div className="text-left">
                <h4 className="text-xl font-black text-white uppercase italic">Station Control</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shift End / Handover</p>
              </div>
            </button>
          </div>
        </div>

        {/* Right: Operator Access Sidebar */}
        <div className="col-span-4 flex flex-col gap-8">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-[2.5rem] p-10 flex flex-col">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-indigo-500/10 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight italic leading-none">Operator Check-in</h3>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center gap-8 py-10">
              <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border-2 border-white/10 relative overflow-hidden group">
                <User className="w-16 h-16 text-white/20 group-hover:text-indigo-500 transition-colors" />
                <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-all" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Identify Yourself</p>
                <h4 className="text-2xl font-black text-white uppercase tracking-tight italic">Scan ID or Tap</h4>
              </div>
              
              <button 
                onClick={() => setShowLogin(true)}
                className="w-full h-20 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
              >
                Log Production <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-auto pt-8 border-t border-white/5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Supervisor Mode</span>
                <button className="text-rose-500 flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <LogOut className="w-3 h-3" /> Deactivate Terminal
                </button>
              </div>
            </div>
          </div>

          <div className="h-40 bg-indigo-600 rounded-[2rem] p-8 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest block mb-2">Shift Info</span>
            <h4 className="text-2xl font-black text-white uppercase italic leading-none">Morning Alpha</h4>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-indigo-100 uppercase">
              <Clock className="w-4 h-4" /> Ends in 02h 45m
            </div>
          </div>
        </div>
      </main>

      {showLogin && (
        <TerminalLogin 
          onSuccess={() => {
            setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
          lineId={terminal?.lineId}
          lineName={terminal?.lineName}
        />
      )}
    </div>
  );
}
