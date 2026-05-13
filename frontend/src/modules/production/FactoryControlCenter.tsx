import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  History,
  Settings2,
  Lock,
  Unlock,
  TrendingUp,
  Layers
} from 'lucide-react';
import { api } from '../../services/api-client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ENDPOINTS } from '../../constants/endpoints';

export default function FactoryControlCenter() {
  const queryClient = useQueryClient();

  const { data: batches } = useQuery({
    queryKey: ['all-production-batches'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data
  });

  const approveMutation = useMutation({
    mutationFn: (batchId: string) => api.post(ENDPOINTS.PRODUCTION.APPROVE_BATCH(batchId)),
    onSuccess: () => {
      toast.success('Batch approved successfully');
      queryClient.invalidateQueries({ queryKey: ['all-production-batches'] });
    }
  });

  const closeMutation = useMutation({
    mutationFn: (batchId: string) => api.patch(ENDPOINTS.PRODUCTION.CLOSE_BATCH(batchId), { remarks: 'Standard Industrial Closure' }),
    onSuccess: () => {
      toast.success('Batch CLOSED and LOCKED for history');
      queryClient.invalidateQueries({ queryKey: ['all-production-batches'] });
    }
  });

  const activeBatches = batches?.filter((b: any) => b.status === 'RUNNING' || b.status === 'ACTIVE') || [];
  const pendingApproval = batches?.filter((b: any) => b.status === 'WAITING_APPROVAL' || b.status === 'QC_PENDING') || [];
  const recentlyClosed = batches?.filter((b: any) => b.status === 'CLOSED' || b.status === 'COMPLETED').slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-10 font-sans">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight italic">Factory Control Center</h1>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Eranad Beverages • Production Oversight Terminal</p>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Active Lines</span>
            <p className="text-xl font-black text-emerald-500">{activeBatches.length}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Pending Approval</span>
            <p className="text-xl font-black text-amber-500">{pendingApproval.length}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10">
        {/* Active Lines Grid */}
        <div className="col-span-8 space-y-10">
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Production Monitor
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeBatches.map((batch: any) => (
                <motion.div
                  layoutId={batch.id}
                  key={batch.id}
                  className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">Line {batch.lineName}</span>
                      <h3 className="text-xl font-black text-white uppercase">{batch.productName}</h3>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                      {batch.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Actual Output</span>
                      <p className="text-lg font-black text-white">{batch.actualQuantity || 0} <span className="text-[10px] text-slate-500 italic">pcs</span></p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Shift Start</span>
                      <p className="text-lg font-black text-white">{new Date(batch.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      <Layers className="w-3 h-3" /> View Station Logs
                    </button>
                    <button className="w-12 h-12 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-black border border-indigo-500/20 rounded-xl transition-all flex items-center justify-center">
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-3">
              <History className="w-4 h-4" />
              Recently Concluded Batches
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Batch Code</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Product</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Total Yield</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Closed At</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentlyClosed.map((batch: any) => (
                    <tr key={batch.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-5 text-xs font-black text-white">{batch.batchCode}</td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-400">{batch.productName}</td>
                      <td className="px-8 py-5 text-xs font-black text-emerald-400">{(batch.actualQuantity || 0).toLocaleString()}</td>
                      <td className="px-8 py-5 text-[10px] font-bold text-slate-500">{batch.closedAt ? formatDistanceToNow(new Date(batch.closedAt)) : 'N/A'} ago</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3 h-3 text-slate-600" />
                          <span className="text-[9px] font-black uppercase text-slate-600">Locked</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Action Queue Sidebar */}
        <div className="col-span-4 space-y-8">
          <section className="bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Unlock className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-amber-500">Approval Queue</h2>
            </div>

            <div className="space-y-4">
              {pendingApproval.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-30">
                  <CheckCircle2 className="w-10 h-10 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Queue Clear</p>
                </div>
              ) : (
                pendingApproval.map((batch: any) => (
                  <div key={batch.id} className="bg-black/40 border border-white/10 rounded-2xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Batch {batch.batchCode}</p>
                        <h4 className="text-sm font-black text-white mt-1">{batch.productName}</h4>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => approveMutation.mutate(batch.id)}
                        className="flex-1 h-10 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => closeMutation.mutate(batch.id)}
                        className="flex-1 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Final Close
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Quick Stats</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500">Efficiency Index</span>
                <span className="text-sm font-black text-emerald-500">92.4%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[92.4%]" />
              </div>

              <div className="flex justify-between items-center pt-4">
                <span className="text-[10px] font-bold text-slate-500">Rejection Rate</span>
                <span className="text-sm font-black text-rose-500">0.8%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 w-[8%]" />
              </div>
            </div>
          </section>

          <button className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-4">
            <TrendingUp className="w-5 h-5" /> Generate Shift Report
          </button>
        </div>
      </div>
    </div>
  );
}
