import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Monitor, Zap, Clock, Activity, ShieldCheck, Settings, Cpu, Target,
  TrendingUp, History, Wind, PackageOpen, Box, Edit, Trash2, Shield, X, AlertTriangle, Eye, Users, Wifi
} from 'lucide-react';
import { api } from '../../services/api-client';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../auth/auth.store';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

function AdminOverview({ allLines, setManualSelection }: any) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: logsData } = useQuery({
    queryKey: ['admin-global-logs'],
    queryFn: async () => (await api.get(ENDPOINTS.TELEMETRY.LOGS, { params: { limit: 100 } })).data,
    refetchInterval: 10000,
  });

  const activeLines = allLines?.filter((l: any) => l.status === 'RUNNING') || [];
  const globalLogs = logsData?.data || [];
  const recentActivity = globalLogs.slice(0, 10);
  const productionHistory = globalLogs;

  const [editingLog, setEditingLog] = useState<any>(null);
  const [correctionPrimary, setCorrectionPrimary] = useState(0);
  const [correctionWastage, setCorrectionWastage] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');

  const correctMutation = useMutation({
    mutationFn: async ({ id, data, reason }: any) => {
      return await api.post(`${ENDPOINTS.PRODUCTION.LOGS_CORRECT.replace(':id', id)}`, { newData: data, reason });
    },
    onSuccess: () => {
      toast.success('Log Corrected Successfully');
      setEditingLog(null);
      setCorrectionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-global-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Correction failed');
    }
  });

  const stations = [
    { id: 'BLOWING', title: 'Blowing', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'FILLING', title: 'Filling', icon: PackageOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'LABELING', title: 'Labeling', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'PACKING', title: 'Packing', icon: Box, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
      <header className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2 flex items-center gap-3">
            <Monitor className="w-8 h-8 text-indigo-500" />
            Production Command Center
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Enterprise Execution System</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2"><Activity className="w-3 h-3 text-emerald-500" /> Lines Running</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{activeLines.length}</span>
            <span className="text-xs font-bold text-slate-500">/ {allLines?.length || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2"><Users className="w-3 h-3 text-blue-500" /> Active Operators</p>
          <span className="text-4xl font-black text-white">12</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2"><ShieldCheck className="w-3 h-3 text-indigo-500" /> System Status</p>
          <span className="text-2xl font-black text-emerald-400 uppercase tracking-widest">Healthy</span>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Factory Overview</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {allLines?.map((line: any) => (
              <div key={line.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl group hover:border-slate-700 transition-all flex flex-col justify-between min-h-[400px] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">{line.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Batch: <span className="text-white">{line.batch?.batchCode || 'NONE'}</span> • {line.batch?.productName || 'IDLE'}
                      </p>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border",
                      line.status === 'RUNNING' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"
                    )}>
                      {line.status === 'RUNNING' && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                      {line.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-3 bg-slate-800/50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Production</p>
                      <p className="text-lg font-black text-white">{line.batch?.actual?.toLocaleString() || 0}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Target</p>
                      <p className="text-lg font-black text-slate-300">{line.batch?.targetQuantity?.toLocaleString() || 0}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Efficiency</p>
                      <p className="text-lg font-black text-emerald-400">
                        {line.batch?.targetQuantity ? Math.round(((line.batch?.actual || 0) / line.batch.targetQuantity) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {stations.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.bg)}>
                            <s.icon className={cn("w-4 h-4", s.color)} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-white uppercase tracking-widest">{s.title}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase">Operator: Unknown</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-black text-slate-300">0</span>
                          <div className="w-2 h-2 rounded-full bg-slate-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button onClick={() => setManualSelection({ lineId: line.id, station: 'BLOWING', lineName: line.name })} className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/50">
                    <Monitor className="w-3.5 h-3.5" /> Open Station
                  </button>
                  <button className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                    <Activity className="w-3.5 h-3.5" /> Analytics
                  </button>
                </div>
              </div>
            ))}
            {allLines?.length === 0 && (
              <div className="col-span-2 p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
                <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">No active production detected</p>
                <p className="text-[10px] font-bold text-slate-500 mt-2">Waiting for operator activity...</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6">Production History Panel</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="py-3 px-4">Date/Time</th>
                    <th className="py-3 px-4">Station</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Production</th>
                    <th className="py-3 px-4">Waste</th>
                    <th className="py-3 px-4">Status</th>
                    {user?.role === 'Admin' && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs font-bold text-slate-300">
                  {productionHistory?.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">{format(new Date(log.timestamp), 'MMM dd, HH:mm')}</td>
                      <td className="py-3 px-4">{log.station}</td>
                      <td className="py-3 px-4">{log.batch?.batchCode || '---'}</td>
                      <td className="py-3 px-4 font-black text-indigo-400">+{log.primaryCount}</td>
                      <td className="py-3 px-4 font-black text-amber-400">{log.wastageCount}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-slate-800 rounded-md text-[9px] uppercase">{log.status}</span>
                      </td>
                      {user?.role === 'Admin' && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingLog(log);
                              setCorrectionPrimary(log.primaryCount);
                              setCorrectionWastage(log.wastageCount);
                              setCorrectionReason('');
                            }}
                            className="flex items-center justify-end gap-2 text-indigo-400 hover:text-indigo-300 text-[10px] uppercase font-black tracking-widest ml-auto"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {productionHistory?.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No History Available</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl sticky top-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" /> Activity Feed
            </h2>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/20 before:to-transparent">
              {recentActivity.map((log: any, i: number) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border border-indigo-500 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  </div>
                  <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-white text-xs">{log.station} Logged</span>
                      <time className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{format(new Date(log.timestamp), 'HH:mm')}</time>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">+{log.primaryCount} units completed by {log.operator?.name || 'Operator'}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mt-4">Waiting for incoming logs...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLog(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-slate-900 border border-slate-700 rounded-[2rem] p-10 w-full max-w-lg relative z-10 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Shield className="w-40 h-40" /></div>
              <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3"><Edit className="w-6 h-6 text-indigo-500" /> Forensic Correction</h2>
              <p className="text-slate-400 text-sm font-bold mb-8 uppercase tracking-widest">Admin Authorization Required</p>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Production Count</label>
                    <input type="number" value={correctionPrimary} onChange={(e) => setCorrectionPrimary(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Wastage Count</label>
                    <input type="number" value={correctionWastage} onChange={(e) => setCorrectionWastage(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Reason for Audit (Required)</label>
                  <textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Provide mandatory audit trail justification..." className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]" />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                  <button onClick={() => setEditingLog(null)} className="flex-1 px-6 py-4 bg-slate-800 text-slate-300 rounded-2xl font-black hover:bg-slate-700 transition-all uppercase tracking-widest text-xs">Cancel</button>
                  <button onClick={() => correctMutation.mutate({ id: editingLog.id, data: { primaryCount: correctionPrimary, wastageCount: correctionWastage }, reason: correctionReason })} disabled={!correctionReason || correctMutation.isPending} className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/50 uppercase tracking-widest text-xs disabled:opacity-50">
                    {correctMutation.isPending ? 'Committing...' : 'Apply Correction'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminOverview;
