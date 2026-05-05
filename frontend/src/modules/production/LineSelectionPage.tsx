import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import {
  Cpu, ArrowRight, Loader2,
  Activity, ShieldCheck, LogOut
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

export default function LineSelectionPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: lines, isLoading } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  if (isLoading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
      <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      <p className="font-black uppercase tracking-widest text-[10px] text-slate-500">Initializing Factory Grid...</p>
    </div>
  );

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {lines?.map((line: any) => (
            <button
              key={line.id}
              onClick={() => navigate(`/line/${line.id}/operator`)}
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
      </div>

      {/* Footer */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Ernad v2.0 • Industrial MES Grid</span>
      </div>
    </div>
  );
}
