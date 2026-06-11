import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Wind, PackageOpen, Zap, Box, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api-client';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import OperatorPanel from './OperatorPanel';

export default function TerminalDashboard() {
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const { data: allLines, isLoading: isLoadingLines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data,
  });

  const stations = [
    { id: 'BLOWING', title: 'Blowing Station', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { id: 'FILLING', title: 'Filling Station', icon: PackageOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { id: 'LABELING', title: 'Labeling Station', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { id: 'PACKING', title: 'Packing Station', icon: Box, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ];

  if (selectedLineId && selectedStation) {
    return (
      <div className="flex flex-col h-full bg-[#f8fafc]">
        <div className="h-16 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center sticky top-0 z-50">
          <button
            onClick={() => setSelectedStation(null)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Stations
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <OperatorPanel lineId={selectedLineId} station={selectedStation} isAdminTerminal={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {selectedLineId && !selectedStation && (
          <button 
            onClick={() => setSelectedLineId(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Lines
          </button>
        )}

        <div className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">
            {!selectedLineId ? 'Select Production Line' : 'Select Workstation'}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Admin Remote Terminal Access
          </p>
        </div>

        {isLoadingLines ? (
          <div className="flex justify-center p-20">
            <Activity className="w-12 h-12 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {!selectedLineId ? (
              allLines?.map((line: any) => (
                <button
                  key={line.id}
                  onClick={() => setSelectedLineId(line.id)}
                  className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left flex flex-col justify-between min-h-[200px] group"
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{line.name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                      Batch: <span className="text-slate-700">{line.batch?.batchCode || 'NONE'}</span>
                    </p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 self-start border",
                    line.status === 'RUNNING' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-500"
                  )}>
                    {line.status === 'RUNNING' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                    {line.status}
                  </div>
                </button>
              ))
            ) : (
              stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStation(s.id)}
                  className={cn(
                    "bg-white border p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between min-h-[200px] group",
                    s.border, "hover:border-opacity-100"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", s.bg)}>
                    <s.icon className={cn("w-6 h-6", s.color)} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{s.title}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Connect Station</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
