import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, RefreshCw,
  Edit3, AlertCircle,
  X, ShieldCheck
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import { toast } from 'sonner';

// --- COMPONENTS ---

const TechnicalBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f8fafc]">
    <div
      className="absolute inset-0 opacity-[0.4]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }}
    />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(248,250,252,0)_50%,rgba(226,232,240,0.05)_50%),linear-gradient(90deg,rgba(79,70,229,0.01),rgba(16,185,129,0.005),rgba(79,70,229,0.01))] z-10 bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40" />
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[120px]" />
  </div>
);

const Badge = ({ children, variant = 'default' }: any) => {
  const styles: any = {
    default: 'bg-slate-100 text-slate-500 border-slate-200',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border inline-block", styles[variant])}>
      {children}
    </span>
  );
};

export default function ProductionLogsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<any>({
    lineId: '',
    station: '',
    batchId: '',
    startDate: '',
    endDate: '',
    isDeleted: false
  });
  const [search, setSearch] = useState('');
  const [editingLog, setEditingLog] = useState<any>(null);
  const [verifyingLog, setVerifyingLog] = useState<any>(null);
  const [rejectingLog, setRejectingLog] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verificationRemarks, setVerificationRemarks] = useState('');

  // --- DATA FETCHING ---
  const { data: logs, isLoading: loadingLogs, refetch } = useQuery({
    queryKey: ['production-logs-all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.append(key, String(val));
      });
      return (await api.get(`${ENDPOINTS.TELEMETRY.LOGS}?${params.toString()}`)).data;
    }
  });

  const { data: batches } = useQuery({
    queryKey: ['production-batches-all'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data
  });

  const { data: lines } = useQuery({
    queryKey: ['master-data-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data
  });

  // --- MUTATIONS ---
  const verifyMutation = useMutation({
    mutationFn: async ({ id, remarks }: any) => {
      return await api.post(`${ENDPOINTS.PRODUCTION.LOGS_VERIFY.replace(':id', id)}`, { remarks });
    },
    onSuccess: () => {
      toast.success('Log Verified');
      setVerifyingLog(null);
      setVerificationRemarks('');
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: any) => {
      return await api.post(`${ENDPOINTS.PRODUCTION.LOGS_REJECT.replace(':id', id)}`, { reason });
    },
    onSuccess: () => {
      toast.success('Log Rejected');
      setRejectingLog(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
    }
  });

  const correctMutation = useMutation({
    mutationFn: async ({ id, data, reason }: any) => {
      return await api.post(`${ENDPOINTS.PRODUCTION.LOGS_CORRECT.replace(':id', id)}`, { newData: data, reason });
    },
    onSuccess: () => {
      toast.success('Log Corrected');
      setEditingLog(null);
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
    }
  });

  // --- UI LOGIC ---
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!search) return logs;
    return logs.filter((l: any) =>
      l.userName?.toLowerCase().includes(search.toLowerCase()) ||
      l.remarks?.toLowerCase().includes(search.toLowerCase()) ||
      String(l.id).includes(search)
    );
  }, [logs, search]);

  if (loadingLogs) return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center relative overflow-hidden text-slate-900">
      <TechnicalBackground />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-t-2 border-indigo-500 rounded-full mb-6"
      />
      <p className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">Synchronizing Logs...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-indigo-500 selection:text-white pb-20">
      <TechnicalBackground />

      <main className="relative z-10 p-8 lg:p-12 space-y-12 max-w-[1800px] mx-auto">

        {/* --- HEADER --- */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
                <Database size={32} />
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Audit <span className="text-indigo-600">Logs</span>
              </h1>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] ml-1 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Verified Transactional Integrity • Real-time Monitoring
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => refetch()}
              className="p-4 bg-slate-50 text-slate-400 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all group active:scale-95"
            >
              <RefreshCw className="group-hover:rotate-180 transition-transform duration-700" size={20} />
            </button>
          </div>
        </header>

        {/* --- FILTER BAR --- */}
        <section className="bg-white border border-slate-200/60 p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Line Filter</label>
            <select
              value={filters.lineId}
              onChange={(e) => setFilters({ ...filters, lineId: e.target.value })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">All Lines</option>
              {lines?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Station Unit</label>
            <select
              value={filters.station}
              onChange={(e) => setFilters({ ...filters, station: e.target.value })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">All Stations</option>
              <option value="BLOWING">Blowing</option>
              <option value="FILLING">Filling</option>
              <option value="LABELING">Labeling</option>
              <option value="PACKING">Packing</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Batch Context</label>
            <select
              value={filters.batchId}
              onChange={(e) => setFilters({ ...filters, batchId: e.target.value })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">All Batches</option>
              {batches?.map((b: any) => <option key={b.id} value={b.id}>{b.batchCode}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Date Range</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Search</label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search Logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                "w-10 h-6 rounded-full p-1 transition-all",
                filters.isDeleted ? "bg-rose-600" : "bg-slate-200"
              )}
                onClick={() => setFilters({ ...filters, isDeleted: !filters.isDeleted })}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full transition-all",
                  filters.isDeleted ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Show Voided</span>
            </label>
          </div>
        </section>

        {/* --- MAIN LEDGER --- */}
        <div className="bg-white border border-slate-200/60 rounded-[3rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identification</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Line / Batch</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Station</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Yield / Scrap</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Used</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Verification</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filteredLogs.map((log: any, i: number) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors group",
                        log.deletedAt && "opacity-40 grayscale pointer-events-none"
                      )}
                    >
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors font-mono tracking-tight">#{log.id}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{format(new Date(log.loggedAt), 'HH:mm:ss')}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-600 uppercase tracking-tight">{log.lineName}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 font-mono uppercase">{log.batchCode}</p>
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant="indigo">{log.station}</Badge>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-sm font-black text-slate-900 tabular-nums font-mono">{(log.primaryCount || 0).toLocaleString()}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Production</p>
                          </div>
                          <div>
                            <p className="text-sm font-black text-rose-600 tabular-nums font-mono">{(log.wastageCount || 0).toLocaleString()}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Wastage</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-indigo-600 tabular-nums font-mono">{(log.primaryCount + log.wastageCount).toLocaleString()}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Total Used</p>
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant={
                          log.status === 'VERIFIED' ? 'success' :
                            log.status === 'REJECTED' ? 'danger' :
                              log.status === 'CORRECTED' ? 'warning' :
                                'indigo'
                        }>
                          {log.status || 'SUBMITTED'}
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        {!log.deletedAt && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {log.status !== 'VERIFIED' && log.userId !== user?.id && (
                              <button
                                onClick={() => setVerifyingLog(log)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-lg transition-all"
                                title="Verify Log"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            {log.status === 'SUBMITTED' && log.userId !== user?.id && (
                              <button
                                onClick={() => setRejectingLog(log)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition-all"
                                title="Reject Log"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingLog(log)}
                              className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && !loadingLogs && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Database className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No Records Found</h4>
            </div>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingLog(null)} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="relative w-full max-w-lg bg-white border-l border-slate-200 h-full rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Correct <span className="text-indigo-600">Log</span></h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Entry ID: #{editingLog.id}</p>
                </div>
                <button onClick={() => setEditingLog(null)} className="p-3 bg-slate-50 rounded-2xl text-slate-500 hover:text-slate-900 transition-all"><X size={24} /></button>
              </div>

              <form className="space-y-8" onSubmit={(e) => {
                e.preventDefault();
                correctMutation.mutate({
                  id: editingLog.id,
                  data: {
                    primaryCount: editingLog.primaryCount,
                    wastageCount: editingLog.wastageCount,
                    remarks: editingLog.remarks
                  },
                  reason: editingLog.remarks
                });
              }}>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Count</label>
                    <input
                      type="number"
                      value={editingLog.primaryCount}
                      onChange={(e) => setEditingLog({ ...editingLog, primaryCount: Number(e.target.value) })}
                      className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wastage Count</label>
                    <input
                      type="number"
                      value={editingLog.wastageCount}
                      onChange={(e) => setEditingLog({ ...editingLog, wastageCount: Number(e.target.value) })}
                      className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-rose-600 outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correction Reason</label>
                  <textarea
                    required
                    value={editingLog.remarks}
                    onChange={(e) => setEditingLog({ ...editingLog, remarks: e.target.value })}
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/50 transition-all resize-none"
                  />
                </div>

                <button type="submit" disabled={correctMutation.isPending} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95">
                  Commit Correction
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {verifyingLog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setVerifyingLog(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white border border-slate-200 rounded-[3rem] p-10 shadow-2xl">
              <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic text-center">Authorize <span className="text-emerald-600">Verification</span></h3>
              <p className="text-slate-500 font-bold mt-2 text-sm text-center mb-8">Seal this record for batch DNA finalization.</p>

              <textarea
                placeholder="Verification remarks (optional)..."
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500/50 transition-all mb-8 resize-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setVerifyingLog(null)} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button onClick={() => verifyMutation.mutate({ id: verifyingLog.id, remarks: verificationRemarks })} disabled={verifyMutation.isPending} className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]">Confirm</button>
              </div>
            </motion.div>
          </div>
        )}

        {rejectingLog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setRejectingLog(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white border border-slate-200 rounded-[3rem] p-10 shadow-2xl">
              <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic text-center">Reject <span className="text-rose-600">Transaction</span></h3>
              <p className="text-slate-500 font-bold mt-2 text-sm text-center mb-8">Voiding this record will reconcile batch totals.</p>

              <textarea
                placeholder="Reason for rejection (required)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:border-rose-500/50 transition-all mb-8 resize-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setRejectingLog(null)} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button
                  onClick={() => rejectMutation.mutate({ id: rejectingLog.id, reason: rejectionReason })}
                  disabled={!rejectionReason || rejectMutation.isPending}
                  className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
