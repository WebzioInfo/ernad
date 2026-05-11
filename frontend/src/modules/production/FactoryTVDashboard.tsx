import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Zap,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { api } from '../../services/api-client';
import { cn } from '../../lib/utils';

export default function FactoryTVDashboard() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());

  // Auto-refresh every 10 seconds for TV mode
  const { data: factoryState } = useQuery({
    queryKey: ['factory-tv-state'],
    queryFn: async () => (await api.get('/analytics/factory/live')).data,
    refetchInterval: 10000
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const lines = factoryState?.activeLines || [];

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-sans overflow-hidden">
      {/* Cinematic Header */}
      <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">
              Eranad <span className="text-indigo-500">Live</span> MES
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-1">Real-time Factory Execution Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">System Time</span>
            <p className="text-3xl font-black tabular-nums">{now.toLocaleTimeString([], { hour12: false })}</p>
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Grid Layout for TV Visibility */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-160px)]">
        
        {/* Main Production Grid */}
        <div className="col-span-9 grid grid-cols-2 gap-6">
          {lines.map((line: any) => (
            <div 
              key={line.id} 
              className={cn(
                "relative rounded-[2rem] border-2 p-8 overflow-hidden transition-all",
                line.status === 'RUNNING' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
              )}
            >
              {/* Background Status Pulse */}
              <div className={cn(
                "absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 -mr-32 -mt-32",
                line.status === 'RUNNING' ? "bg-emerald-500" : "bg-amber-500"
              )} />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Station: {line.factoryName}</span>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tight">Line {line.name}</h2>
                  </div>
                  <div className={cn(
                    "px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest border",
                    line.status === 'RUNNING' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  )}>
                    {line.status}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-10">
                  <div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Shift Target</span>
                    <p className="text-4xl font-black text-white">{(line.target || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Actual Achievement</span>
                    <p className="text-4xl font-black text-emerald-400">{(line.actual || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">OEE Index</span>
                    <p className="text-4xl font-black text-indigo-400">{(line.oee || 0).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Production Efficiency</span>
                    <span className="text-emerald-500">{((line.actual / (line.target || 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (line.actual / (line.target || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar: Alerts & Analytics */}
        <div className="col-span-3 flex flex-col gap-6">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-8 flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              Live Alerts
            </h3>
            
            <div className="space-y-4 flex-1">
              {[
                { type: 'DOWNTIME', msg: 'Line 02: Power Failure Detected', time: '4m ago', level: 'CRITICAL' },
                { type: 'QC', msg: 'Batch EB-2026-44: pH Variance Detected', time: '12m ago', level: 'WARNING' },
                { type: 'STOCK', msg: 'Low Stock: Preforms (500ml)', time: '1h ago', level: 'INFO' }
              ].map((alert, i) => (
                <div key={i} className="p-5 bg-black/40 border border-white/5 rounded-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded",
                      alert.level === 'CRITICAL' ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500"
                    )}>{alert.level}</span>
                    <span className="text-[8px] font-bold text-slate-600 uppercase">{alert.time}</span>
                  </div>
                  <p className="text-xs font-black text-white">{alert.msg}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">Global OEE</span>
                  <p className="text-4xl font-black text-white">84.2%</p>
                </div>
                <TrendingUp className="w-10 h-10 text-emerald-500/50 mb-1" />
              </div>
            </div>
          </div>

          <div className="h-40 bg-indigo-600 rounded-[2rem] p-8 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
            <h4 className="text-xl font-black uppercase italic leading-none mb-2">Shift Alpha</h4>
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Supervisor: Rajesh K.</p>
            <ShieldCheck className="absolute bottom-6 right-8 w-12 h-12 text-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
