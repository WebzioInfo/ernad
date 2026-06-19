import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, RefreshCw,
  AlertCircle, Loader2,
  X, ShieldCheck
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import { toast } from 'sonner';
import { Pagination } from '../../components/common/Pagination';

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

const formatDecimal = (val: string | number | null | undefined) => {
  if (val === null || val === undefined) return '0';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num % 1 === 0 ? num.toLocaleString() : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ProductionLogsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<any>({
    lineId: '',
    station: '',
    batchCode: '',
    date: '',
    isDeleted: false
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingLog, setEditingLog] = useState<any>(null);
  const [originalLog, setOriginalLog] = useState<any>(null);
  const [verifyingLog, setVerifyingLog] = useState<any>(null);
  const [rejectingLog, setRejectingLog] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [viewingLog, setViewingLog] = useState<any>(null);

  const userRoles = [user?.role, ...(user?.roles || [])].map((r: any) => String(r).toUpperCase());
  const canAct = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, debouncedSearch, pageSize]);

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials-packing'],
    queryFn: async () => (await api.get(`${ENDPOINTS.MASTER_DATA.RAW_MATERIALS}?station=PACKING`)).data,
  });
  const packingRawMaterials = rawMaterials || [];

  const toggleEditingShrink = (material: any) => {
    setEditingLog((prev: any) => {
      if (!prev) return null;
      const currentShrinks = prev.selectedShrinks || [];
      const exists = currentShrinks.find((s: any) => s.shrinkId === material.id);
      let newShrinks;
      if (exists) {
        newShrinks = currentShrinks.filter((s: any) => s.shrinkId !== material.id);
      } else {
        newShrinks = [...currentShrinks, { shrinkId: material.id, shrinkName: material.name, mmUsed: 0, wastageKg: 0 }];
      }
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  const handleEditingMmUsedChange = (shrinkId: string, value: number) => {
    setEditingLog((prev: any) => {
      if (!prev) return null;
      const currentShrinks = prev.selectedShrinks || [];
      const newShrinks = currentShrinks.map((s: any) =>
        s.shrinkId === shrinkId ? { ...s, mmUsed: value } : s
      );
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  const handleEditingWastageKgChange = (shrinkId: string, value: number) => {
    setEditingLog((prev: any) => {
      if (!prev) return null;
      const currentShrinks = prev.selectedShrinks || [];
      const newShrinks = currentShrinks.map((s: any) =>
        s.shrinkId === shrinkId ? { ...s, wastageKg: value } : s
      );
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  const isDirty = useMemo(() => {
    if (!editingLog || !originalLog) return false;
    
    if (editingLog.primaryCount !== originalLog.primaryCount) return true;
    if (editingLog.wastageCount !== originalLog.wastageCount) return true;
    if (editingLog.remarks !== originalLog.remarks) return true;
    if (editingLog.shrinkWastageKg !== originalLog.shrinkWastageKg) return true;
    if (editingLog.editDate !== originalLog.editDate) return true;
    if (editingLog.editTime !== originalLog.editTime) return true;

    const origShrinks = originalLog.selectedShrinks || [];
    const editShrinks = editingLog.selectedShrinks || [];
    if (origShrinks.length !== editShrinks.length) return true;
    for (let i = 0; i < origShrinks.length; i++) {
      const origS = origShrinks[i];
      const editS = editShrinks.find((s: any) => s.shrinkId === origS.shrinkId);
      if (!editS) return true;
      if (Number(editS.mmUsed) !== Number(origS.mmUsed)) return true;
      if (Number(editS.wastageKg || 0) !== Number(origS.wastageKg || 0)) return true;
    }

    return false;
  }, [editingLog, originalLog]);

  // --- DATA FETCHING ---
  const { data: logsData, isLoading: loadingLogs, refetch } = useQuery({
    queryKey: ['production-logs-all', filters, currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (key === 'date') return;
        if (val) params.append(key, String(val));
      });
      if (filters.date) {
        const [y, m, d] = filters.date.split('-');
        const start = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
        const end = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
      }
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));
      if (debouncedSearch) params.append('search', debouncedSearch);
      return (await api.get(`${ENDPOINTS.TELEMETRY.LOGS}?${params.toString()}`)).data;
    },
    staleTime: 10000,
  });

  const { data: batches } = useQuery({
    queryKey: ['production-batches-all'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data
  });

  const uniqueBatches = useMemo(() => {
    if (!batches) return [];
    return Array.from(new Map(batches.map((b: any) => [b.batchCode, b])).values());
  }, [batches]);

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
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['batch-forensics'] });
      queryClient.invalidateQueries({ queryKey: ['batch-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['batch-forensics'] });
      queryClient.invalidateQueries({ queryKey: ['batch-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['batch-forensics'] });
      queryClient.invalidateQueries({ queryKey: ['batch-logs'] });
    }
  });

  // --- UI LOGIC ---
  const paginatedLogs = logsData?.data || [];
  const totalRecords = logsData?.total || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

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
              value={filters.batchCode}
              onChange={(e) => setFilters({ ...filters, batchCode: e.target.value })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">All Batches</option>
              {uniqueBatches.map((b: any) => <option key={b.batchCode} value={b.batchCode}>{b.batchCode}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Date Range</label>
            <input
              type="date"
              value={filters.date || ''}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
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
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Production</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Wastage</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Material Usage</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Verification</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {paginatedLogs.map((log: any, i: number) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setViewingLog(log)}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors group cursor-pointer",
                        log.deletedAt && "opacity-40 grayscale pointer-events-none"
                      )}
                    >
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight truncate max-w-[150px]">{log.userName || log.user?.name || 'Operator'}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">#{log.id}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-600 uppercase tracking-tight truncate max-w-[120px]">{log.lineName || log.line?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 font-mono uppercase">{log.batchCode || log.batch?.batchCode}</p>
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant="indigo">{log.station}</Badge>
                      </td>
                      <td className="px-8 py-6">
                        {log.station === 'PACKING' ? (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-900 tabular-nums font-mono">{(log.casesProduced || 0).toLocaleString()}</p>
                            <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">Cases</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-900 tabular-nums font-mono">{(log.primaryCount || 0).toLocaleString()}</p>
                            <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Units</span>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-rose-600 tabular-nums font-mono">{formatDecimal(log.wastageCount)}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                          {log.materialConsumption && log.materialConsumption.length > 0 ? (
                            log.materialConsumption.map((mc: any, idx: number) => {
                              const nameLower = (mc.name || '').toLowerCase();
                              let icon = '📦';
                              if (nameLower.includes('label')) icon = '🏷️';
                              else if (nameLower.includes('cap')) icon = '🧴';
                              else if (nameLower.includes('shrink')) icon = '🔥';
                              else if (nameLower.includes('glue')) icon = '🧪';
                              else if (nameLower.includes('preform')) icon = '🧪';

                              return (
                                <div 
                                  key={idx} 
                                  className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md"
                                  title={`${mc.name}\n${formatDecimal(mc.quantity)} ${mc.unit}`}
                                >
                                  <span className="text-xs">{icon}</span>
                                  <span className="text-[10px] font-black text-slate-700">{formatDecimal(mc.quantity)}</span>
                                  <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[80px]">{mc.name.includes('Shrink') ? 'Shrink' : mc.name.includes('Label') ? 'Labels' : mc.name.includes('Cap') ? 'Caps' : mc.name.includes('Preform') ? 'Bags' : mc.unit}</span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">No Material Record</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {log.remarks ? (
                          <div className="group relative inline-block">
                            <p className="text-xs font-bold text-slate-600 truncate max-w-[150px] cursor-help">
                              {log.remarks.length > 50 ? `${log.remarks.substring(0, 50)}...` : log.remarks}
                            </p>
                            {log.remarks.length > 50 && (
                              <div className="absolute z-50 invisible group-hover:visible bg-slate-900 text-white text-[10px] font-bold p-3 rounded-xl -top-10 left-0 whitespace-nowrap shadow-xl">
                                {log.remarks}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-black">—</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {log.loggedAt || log.createdAt || log.timestamp ? (
                          <span className="text-xs font-bold text-slate-600">
                            {format(new Date(log.loggedAt || log.createdAt || log.timestamp), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-black">—</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {log.loggedAt || log.createdAt || log.timestamp ? (
                          <span className="text-xs font-bold text-slate-600 uppercase">
                            {format(new Date(log.loggedAt || log.createdAt || log.timestamp), 'hh:mm a')}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-black">—</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant={
                          log.status === 'VERIFIED' ? 'success' :
                            log.status === 'REJECTED' ? 'danger' :
                              log.status === 'CORRECTED' ? 'warning' :
                                'indigo'
                        }>
                          {log.status === 'VERIFIED' ? 'APPROVED' : (log.status || 'SUBMITTED')}
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        {!log.deletedAt && canAct && (
                          <div className="flex flex-col xl:flex-row items-end xl:items-center justify-end gap-2 opacity-100 visible min-w-[220px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const selectedShrinksCopy = log.selectedShrinks 
                                  ? JSON.parse(JSON.stringify(log.selectedShrinks))
                                  : [];
                                const dateObj = new Date(log.loggedAt || log.createdAt || log.timestamp || Date.now());
                                const logCopy = {
                                  ...log,
                                  selectedShrinks: selectedShrinksCopy,
                                  shrinkWastageKg: log.shrinkWastageKg !== undefined ? Number(log.shrinkWastageKg) : 0,
                                  editDate: format(dateObj, 'yyyy-MM-dd'),
                                  editTime: format(dateObj, 'HH:mm')
                                };
                                setEditingLog(logCopy);
                                setOriginalLog(JSON.parse(JSON.stringify(logCopy)));
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer"
                              aria-label="Edit Production Log"
                            >
                              Edit
                            </button>
                            {log.status !== 'VERIFIED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setVerifyingLog(log); }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer"
                                aria-label="Approve Production Log"
                              >
                                Approve
                              </button>
                            )}
                            {log.status !== 'REJECTED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setRejectingLog(log); }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer"
                                aria-label="Reject Production Log"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRecords={totalRecords}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
          {paginatedLogs.length === 0 && !loadingLogs && (
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
                let totalWastage = Number(editingLog.wastageCount || 0);
                if (editingLog.station === 'PACKING') {
                  totalWastage = (editingLog.selectedShrinks || []).reduce((sum: number, s: any) => sum + (s.wastageKg || 0), 0);
                }
                const payload: any = {
                  primaryCount: editingLog.primaryCount,
                  wastageCount: totalWastage,
                  remarks: editingLog.remarks
                };
                
                const newTimestamp = new Date(`${editingLog.editDate}T${editingLog.editTime}`);
                if (newTimestamp.getTime() !== new Date(originalLog.loggedAt).getTime()) {
                  payload.loggedAt = newTimestamp.toISOString();
                }

                if (editingLog.station === 'PACKING') {
                  payload.shrinkWastageKg = totalWastage;
                  payload.selectedShrinks = editingLog.selectedShrinks || [];
                }
                if (editingLog.station === 'LABELING') {
                  payload.glueUsedKg = Number(editingLog.glueUsageKg || 0);
                  payload.rollsUsed = Number(editingLog.rollsUsed || 0);
                  payload.labelsUsed = Number(editingLog.bopRollUsage || 0);
                  payload.damagedLabelWeight = totalWastage;
                  payload.makeupChanged = editingLog.makeupChanged;
                }
                if (editingLog.station === 'BLOWING') {
                  payload.bagsUsed = editingLog.bagsUsed ? Number(editingLog.bagsUsed) : undefined;
                }
                if (editingLog.station === 'FILLING') {
                  payload.capBoxUsage = editingLog.capBoxUsage ? Number(editingLog.capBoxUsage) : undefined;
                }
                correctMutation.mutate({
                  id: editingLog.id,
                  data: payload,
                  reason: editingLog.remarks
                });
              }}>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Date</label>
                    <input
                      type="date"
                      value={editingLog.editDate}
                      onChange={(e) => setEditingLog({ ...editingLog, editDate: e.target.value })}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Time</label>
                    <input
                      type="time"
                      value={editingLog.editTime}
                      onChange={(e) => setEditingLog({ ...editingLog, editTime: e.target.value })}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                  {originalLog && (editingLog.editDate !== originalLog.editDate || editingLog.editTime !== originalLog.editTime) && (
                    <div className="col-span-2 mt-2 text-xs font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <AlertCircle className="inline-block w-4 h-4 mr-1 mb-0.5" />
                      Changing production date/time will recalculate reports and analytics.
                      <div className="mt-1 flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
                        <div>Original: {format(new Date(originalLog.loggedAt), 'dd-MM-yyyy HH:mm')}</div>
                        <div className="text-amber-700">New: {format(new Date(`${editingLog.editDate}T${editingLog.editTime}`), 'dd-MM-yyyy HH:mm')}</div>
                      </div>
                    </div>
                  )}
                </div>
                {editingLog.station === 'PACKING' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Count</label>
                        <input
                          type="number"
                          value={editingLog.primaryCount}
                          onChange={(e) => setEditingLog({ ...editingLog, primaryCount: Number(e.target.value) })}
                          className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-4 text-lg font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Batch Number</label>
                        <input
                          type="text"
                          value={editingLog.sourceBatchNumber || 'N/A'}
                          readOnly
                          className="w-full h-14 bg-slate-200 border-none rounded-xl px-4 text-sm font-mono font-bold text-slate-500 outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                        Select Shrink Materials
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {packingRawMaterials.filter((m: any) => m.materialType === 'SHRINK').map((material: any) => {
                          const isSelected = (editingLog.selectedShrinks || []).some((s: any) => s.shrinkId === material.id);
                          return (
                            <button
                              key={material.id}
                              type="button"
                              onClick={() => toggleEditingShrink(material)}
                              className={`w-28 px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all duration-200 relative overflow-hidden h-11 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-500'
                                  : 'bg-white border-slate-200 hover:border-indigo-500/45'
                              }`}
                            >
                              <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                {material.name.match(/(\d+)\s*(?:mm|m)/i)
                                  ? `${material.name.match(/(\d+)\s*(?:mm|m)/i)![1]}mm`
                                  : material.name}
                              </span>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                  ✓
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {(editingLog.selectedShrinks || []).length > 0 && (
                      <div className="space-y-3 p-4 border border-indigo-150 rounded-xl bg-indigo-50/20">
                        <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                          Usage and Wastage per Selected Shrink
                        </h5>
                        <div className="grid grid-cols-1 gap-2">
                          {(editingLog.selectedShrinks || []).map((shrink: any) => (
                            <div key={shrink.shrinkId} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">{shrink.shrinkName}</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Usage</label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={shrink.mmUsed}
                                      onChange={(e) => handleEditingMmUsedChange(shrink.shrinkId, Number(e.target.value))}
                                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 text-right"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400">KG</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Wastage</label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={shrink.wastageKg || 0}
                                      onChange={(e) => handleEditingWastageKgChange(shrink.shrinkId, Number(e.target.value))}
                                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 text-right"
                                    />
                                    <span className="text-[9px] font-bold text-slate-400">KG</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : editingLog.station === 'LABELING' ? (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Count</label>
                      <input
                        type="number"
                        value={editingLog.primaryCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingLog({ ...editingLog, primaryCount: val, bopRollUsage: String(val + Number(editingLog.wastageCount || 0)) });
                        }}
                        className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wastage Count</label>
                      <input
                        type="number"
                        value={editingLog.wastageCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingLog({ ...editingLog, wastageCount: val, bopRollUsage: String(Number(editingLog.primaryCount || 0) + val) });
                        }}
                        className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-rose-600 outline-none focus:border-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full col-span-2">
                      {(!editingLog.lineName && !editingLog.line?.name ? true : !(editingLog.lineName || editingLog.line?.name)?.toLowerCase().includes('2')) && (
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Glue Used (KG)</label>
                          <input
                            type="number"
                            step="0.001"
                            value={editingLog.glueUsageKg || 0}
                            onChange={(e) => setEditingLog({ ...editingLog, glueUsageKg: e.target.value })}
                            className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                          />
                        </div>
                      )}

                      {(editingLog.lineName || editingLog.line?.name)?.toLowerCase().includes('2') && (
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Rolls Used</label>
                          <input
                            type="number"
                            step="1"
                            value={editingLog.rollsUsed || 0}
                            onChange={(e) => setEditingLog({ ...editingLog, rollsUsed: e.target.value })}
                            className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Makeup Replacement</label>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Toggle if makeup was changed during this log.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={editingLog.makeupChanged || false}
                          onChange={(e) => setEditingLog({ ...editingLog, makeupChanged: e.target.checked })}
                        />
                        <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                  </div>
                ) : (
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
                    {editingLog.station === 'BLOWING' && (
                      <div className="space-y-4 col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bags Used</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingLog.bagsUsed || ''}
                          onChange={(e) => setEditingLog({ ...editingLog, bagsUsed: e.target.value })}
                          className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                        />
                      </div>
                    )}
                    {editingLog.station === 'FILLING' && (
                      <div className="space-y-4 col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cap Boxes Used</label>
                        <input
                          type="number"
                          value={editingLog.capBoxUsage || ''}
                          onChange={(e) => setEditingLog({ ...editingLog, capBoxUsage: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full h-16 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-xl font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 transition-all"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correction Reason</label>
                  <textarea
                    required
                    value={editingLog.remarks}
                    onChange={(e) => setEditingLog({ ...editingLog, remarks: e.target.value })}
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/50 transition-all resize-none"
                  />
                </div>

                 <button type="submit" disabled={correctMutation.isPending || !isDirty} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                  {correctMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Committing Correction...
                    </>
                  ) : (
                    "Commit Correction"
                  )}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => !rejectMutation.isPending && setRejectingLog(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white border border-slate-200 rounded-[3rem] p-10 shadow-2xl">
              <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic text-center">Reject <span className="text-rose-600">Transaction</span></h3>
              <p className="text-slate-500 font-bold mt-2 text-sm text-center mb-8">Rejecting this record will reconcile batch totals.</p>

              <textarea
                placeholder="Reason for rejection (required)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={rejectMutation.isPending}
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm font-bold text-slate-900 outline-none focus:border-rose-500/50 transition-all mb-8 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setRejectingLog(null)} 
                  disabled={rejectMutation.isPending}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => rejectMutation.mutate({ id: rejectingLog.id, reason: rejectionReason })}
                  disabled={!rejectionReason || rejectMutation.isPending}
                  className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Confirm Reject'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setViewingLog(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Production Log #{viewingLog.id}</h2>
                  <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">{viewingLog.station} • {viewingLog.lineName || viewingLog.line?.name} • {viewingLog.batchCode || viewingLog.batch?.batchCode}</p>
                </div>
                <button
                  onClick={() => setViewingLog(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Station</p>
                    <div className="mt-1">
                      <Badge variant="indigo">{viewingLog.station}</Badge>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operator</p>
                    <p className="text-sm font-bold text-slate-900 truncate" title={viewingLog.userName || viewingLog.user?.name}>{viewingLog.userName || viewingLog.user?.name || 'Operator'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch</p>
                    <p className="text-sm font-bold text-slate-900 font-mono uppercase">{viewingLog.batchCode || viewingLog.batch?.batchCode || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Line</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">{viewingLog.lineName || viewingLog.line?.name || '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                    <p className="text-sm font-bold text-slate-900">{viewingLog.loggedAt ? format(new Date(viewingLog.loggedAt), 'MMM dd, yyyy') : '—'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">{viewingLog.loggedAt ? format(new Date(viewingLog.loggedAt), 'hh:mm a') : '—'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Production Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Production</p>
                      <p className="text-2xl font-black text-indigo-600 font-mono">{(viewingLog.primaryCount || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Waste</p>
                      <p className="text-2xl font-black text-rose-600 font-mono">{formatDecimal(viewingLog.wastageCount)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</p>
                      <div>
                        <Badge variant={viewingLog.status === 'VERIFIED' ? 'success' : viewingLog.status === 'REJECTED' ? 'danger' : viewingLog.status === 'CORRECTED' ? 'warning' : 'indigo'}>{viewingLog.status === 'VERIFIED' ? 'APPROVED' : (viewingLog.status || 'SUBMITTED')}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Material Consumption</h3>
                  {viewingLog.materialConsumption && viewingLog.materialConsumption.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Raw Material Name</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Consumed Quantity</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingLog.materialConsumption.map((mc: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-sm font-bold text-slate-700">{mc.name}</td>
                              <td className="px-4 py-3 text-sm font-black text-indigo-600 font-mono text-right">{formatDecimal(mc.quantity)}</td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">{mc.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 text-center">
                      <p className="text-sm font-bold text-slate-400">No Material Record</p>
                    </div>
                  )}
                </div>

                {viewingLog.station === 'LABELING' && (
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Consumables</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Makeup Replacement</p>
                        <div className="mt-1">
                          <Badge variant={viewingLog.makeupChanged ? 'success' : 'slate'}>{viewingLog.makeupChanged ? 'YES' : 'NO'}</Badge>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Makeup Usage</p>
                        <p className="text-sm font-black text-indigo-600 font-mono">{viewingLog.makeupUsageQty || 0} PCS</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Remarks</h3>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{viewingLog.remarks || <span className="text-slate-400 italic">No remarks provided</span>}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Timeline</h3>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Created</p>
                      <p className="text-xs font-bold text-slate-600">{viewingLog.createdAt ? format(new Date(viewingLog.createdAt), 'MMM dd, yyyy hh:mm a') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted / Logged</p>
                      <p className="text-xs font-bold text-slate-600">{viewingLog.loggedAt ? format(new Date(viewingLog.loggedAt), 'MMM dd, yyyy hh:mm a') : '—'}</p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
