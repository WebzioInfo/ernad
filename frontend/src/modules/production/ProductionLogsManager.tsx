import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, RefreshCw,
  Edit3, Shield,
  Box, AlertCircle,
  X, Save, ShieldCheck
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import { toast } from 'sonner';

// --- COMPONENTS ---

const TechnicalBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#02040a]">
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }}
    />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 bg-[length:100%_4px,3px_100%] pointer-events-none opacity-20" />
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[120px]" />
  </div>
);

const Badge = ({ children, variant = 'default' }: any) => {
  const styles: any = {
    default: 'bg-white/10 text-slate-400 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
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

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-300 selection:bg-indigo-500 selection:text-white pb-20">
      <TechnicalBackground />

      <main className="relative z-10 p-8 lg:p-12 space-y-8 max-w-[1800px] mx-auto">

        {/* --- HEADER --- */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-[0_0_40px_rgba(225,29,72,0.3)]">
                <Shield size={32} />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                  Log <span className="text-rose-500">Governance</span>
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_#f43f5e]" />
                  Operational Audit Mode • Enterprise Correction Interface
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => refetch()}
              className="p-4 bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 rounded-2xl hover:bg-indigo-600/20 transition-all group"
            >
              <RefreshCw className="group-hover:rotate-180 transition-transform duration-700" size={20} />
            </button>
          </div>
        </header>

        {/* --- FILTER BAR --- */}
        <section className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Line Filter</label>
            <select
              value={filters.lineId}
              onChange={(e) => setFilters({ ...filters, lineId: e.target.value })}
              className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">All Production Lines</option>
              {lines?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Station Unit</label>
            <select
              value={filters.station}
              onChange={(e) => setFilters({ ...filters, station: e.target.value })}
              className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
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
              className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
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
              className="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Search</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="text"
                placeholder="Remarks/Operator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-12 bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 text-xs font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                "w-10 h-6 rounded-full p-1 transition-all",
                filters.isDeleted ? "bg-rose-600" : "bg-white/10"
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
        <section className="bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                  <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Index / ID</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Production Context</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Count</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Wastage</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Recorded By</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                   <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                <AnimatePresence>
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={7} className="py-24 text-center">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-8 h-8 border-t-2 border-indigo-500 rounded-full mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest animate-pulse">Syncing Enterprise Ledger...</p>
                      </td>
                    </tr>
                  ) : filteredLogs.map((log: any, i: number) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "group hover:bg-white/[0.02] transition-colors",
                        log.deletedAt && "opacity-50 grayscale"
                      )}
                    >
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-white font-mono tracking-tighter">#{log.id}</p>
                        {log.deletedAt && <Badge variant="danger">VOIDED</Badge>}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <Badge variant="indigo">{log.station}</Badge>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter italic">Batch {log.batchId.slice(-6).toUpperCase()}</span>
                        </div>
                        {log.remarks && (
                          <p className="text-[10px] font-bold text-slate-600 mt-1 italic truncate max-w-[200px]">{log.remarks}</p>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-white font-mono">{log.primaryCount.toLocaleString()}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-rose-500 font-mono">{log.wastageCount.toLocaleString()}</p>
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
                        <p className="text-xs font-black text-slate-300 uppercase">{log.userName || 'SYSTEM'}</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Terminal Active</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-bold text-slate-400 font-mono">{format(new Date(log.loggedAt), 'HH:mm:ss')}</p>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{format(new Date(log.loggedAt), 'MMM dd, yyyy')}</p>
                      </td>
                      <td className="px-8 py-6">
                        {!log.deletedAt && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {log.status !== 'VERIFIED' && log.userId !== user?.id && (
                              <button
                                onClick={() => setVerifyingLog(log)}
                                className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded-lg transition-all"
                                title="Verify Log"
                              >
                                <ShieldCheck size={14} />
                              </button>
                            )}
                            {log.status === 'SUBMITTED' && log.userId !== user?.id && (
                              <button
                                onClick={() => setRejectingLog(log)}
                                className="p-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 rounded-lg transition-all"
                                title="Reject Log"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingLog(log)}
                              className="p-2 bg-white/5 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 border border-white/10 rounded-lg transition-all"
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
              <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <Database className="w-8 h-8 text-slate-700" />
              </div>
              <h4 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No Records Found</h4>
              <p className="text-slate-600 text-[10px] font-bold mt-2 uppercase tracking-widest">Adjust filters to broaden the governance scope.</p>
            </div>
          )}
        </section>
      </main>

      {/* --- MODALS --- */}

      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingLog(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="relative w-full max-w-lg bg-[#0a0c14] border-l border-white/10 h-full rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Correct <span className="text-indigo-500">Log</span></h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Entry ID: #{editingLog.id} • Station: {editingLog.station}</p>
                </div>
                <button onClick={() => setEditingLog(null)} className="p-3 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all"><X size={24} /></button>
              </div>

              <form className="space-y-8" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                correctMutation.mutate({
                  id: editingLog.id,
                  data: {
                    primaryCount: Number(formData.get('primaryCount')),
                    wastageCount: Number(formData.get('wastageCount')),
                    remarks: formData.get('remarks')
                  },
                  reason: formData.get('remarks')
                });
              }}>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Primary Yield Correction</label>
                  <div className="relative">
                    <Box className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input
                      type="number"
                      name="primaryCount"
                      defaultValue={editingLog.primaryCount}
                      className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-5 pl-14 pr-6 text-2xl font-mono font-black text-white outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Wastage / Reject Adjustment</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-500/50" size={20} />
                    <input
                      type="number"
                      name="wastageCount"
                      defaultValue={editingLog.wastageCount}
                      className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-5 pl-14 pr-6 text-2xl font-mono font-black text-rose-500 outline-none focus:border-rose-500/30 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Audit Remark (Required)</label>
                  <textarea
                    name="remarks"
                    required
                    placeholder="Provide justification for this data correction..."
                    defaultValue={editingLog.remarks}
                    className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-5 px-6 text-sm font-bold text-slate-300 outline-none focus:border-indigo-500/50 transition-all min-h-[150px]"
                  />
                </div>

                <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                  <div className="flex gap-4">
                    <Shield className="text-amber-500 shrink-0" size={20} />
                    <div>
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Administrative Warning</p>
                      <p className="text-[10px] font-bold text-amber-500/70 leading-relaxed uppercase italic">Any correction will be logged in the permanent audit trail. Production totals for Batch {editingLog.batchId.slice(-6).toUpperCase()} will be reconciled automatically.</p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={correctMutation.isPending}
                  className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-900/40 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {correctMutation.isPending ? <RefreshCw className="animate-spin" /> : <Save size={18} />}
                  Commit Correction
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {verifyingLog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setVerifyingLog(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[#0a0c14] border border-white/10 rounded-[3rem] p-10 shadow-2xl">
              <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter text-center mb-4">Verify Production Log</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center mb-8 px-4">Authorizing entry #{verifyingLog.id} for final batch totals.</p>
              
              <textarea
                placeholder="Verification remarks (optional)..."
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-emerald-500/50 transition-all mb-8 min-h-[100px]"
              />

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setVerifyingLog(null)} className="py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button
                  onClick={() => verifyMutation.mutate({ id: verifyingLog.id, remarks: verificationRemarks })}
                  disabled={verifyMutation.isPending}
                  className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  Confirm Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {rejectingLog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setRejectingLog(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[#0a0c14] border border-white/10 rounded-[3rem] p-10 shadow-2xl">
              <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter text-center mb-4">Reject Production Log</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center mb-8 px-4">Log #{rejectingLog.id} will be marked as invalid. Reason required.</p>
              
              <textarea
                placeholder="Reason for rejection (required)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-rose-500/50 transition-all mb-8 min-h-[100px]"
              />

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setRejectingLog(null)} className="py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
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
