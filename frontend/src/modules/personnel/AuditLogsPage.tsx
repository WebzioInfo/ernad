import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { 
  ClipboardList, Clock, 
  Database, Info, Download,
  Search, AlertCircle, ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface AuditLog {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: any;
  occurredAt: string;
}

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get('/users/audit-logs')).data,
    refetchInterval: 10000 
  });

  const getSeverity = (log: AuditLog) => {
    const action = log.action.toUpperCase();
    const entity = log.entityType.toUpperCase();
    
    if (action.includes('DELETE') || action.includes('RESET-PIN') || entity === 'AUTH') return 'SECURITY';
    if (action.includes('POST') || action.includes('PATCH')) return 'CRITICAL';
    return 'INFO';
  };

  const humanize = (action: string) => {
    if (!action) return 'Unknown Action';
    if (!action.includes(' /')) return action;

    const [method, url] = action.split(' ');
    if (!url) return action;

    if (url.includes('/users')) {
      if (method === 'DELETE') return 'Permanently terminated user access';
      if (method === 'PATCH' || method === 'PUT') return 'Modified personnel profile';
      if (method === 'POST') return 'Provisioned new system user';
    }
    if (url.includes('/master-data/lines')) {
      if (method === 'DELETE') return 'Decommissioned production line';
      if (method === 'PATCH' || method === 'PUT') return 'Reconfigured line parameters';
      if (method === 'POST') return 'Commissioned new production line';
    }
    if (url.includes('/inventory')) return 'Adjusted supply chain inventory';
    if (url.includes('/production-management/batches')) {
       if (method === 'POST') return 'Initiated new production batch';
       return 'Updated batch operational state';
    }
    if (url.includes('/auth/login')) return 'Authenticated user session';

    if (action.includes('BIOMETRIC_CLOCK_IN')) return 'Staff validated via biometric terminal (Entry)';
    if (action.includes('BIOMETRIC_CLOCK_OUT')) return 'Staff validated via biometric terminal (Exit)';
    if (action.includes('AUTO_CLOCK_OUT_OVERRIDE')) return 'Automated system safety override (Auto-ClockOut)';

    return `${method} operation on ${url.split('/')[2] || 'system'}`;
  };

  const exportToCSV = () => {
    if (!logs) return;
    const headers = ['Time', 'Actor', 'Action', 'Entity', 'ID'];
    const rows = logs.map(l => [
      format(new Date(l.occurredAt), 'yyyy-MM-dd HH:mm:ss'),
      l.actorName || 'System',
      humanize(l.action),
      l.entityType,
      l.entityId
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ernad_audit_log_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = !searchTerm || 
      log.actorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'ALL' || getSeverity(log) === severityFilter;
    const matchesModule = moduleFilter === 'ALL' || log.entityType === moduleFilter;

    return matchesSearch && matchesSeverity && matchesModule;
  });

  const entities = Array.from(new Set(logs?.map(l => l.entityType))).filter(Boolean);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
              <ClipboardList className="w-8 h-8" />
            </div>
            Audit Intelligence
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1">Advanced operational oversight and compliance forensics.</p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export Ledger
          </button>
          <div className="bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl text-[10px] font-black flex items-center gap-2 border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Live Sync
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <input 
             type="text" 
             placeholder="Search by actor or action..." 
             className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <FilterSelect 
             value={severityFilter} 
             onChange={setSeverityFilter} 
             options={['ALL', 'SECURITY', 'CRITICAL', 'INFO']} 
             label="Severity" 
           />
           <FilterSelect 
             value={moduleFilter} 
             onChange={setModuleFilter} 
             options={['ALL', ...entities]} 
             label="Module" 
           />
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time & Date</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performed By</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Taken</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Entity Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredLogs?.map((log, idx) => {
                  const severity = getSeverity(log);
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      key={log.id} 
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl border ${
                            severity === 'SECURITY' ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-50' :
                            severity === 'CRITICAL' ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-50' :
                            'bg-slate-50 text-slate-400 border-slate-100 shadow-slate-50'
                          } shadow-inner group-hover:scale-110 transition-transform`}>
                            {severity === 'SECURITY' ? <ShieldAlert className="w-4 h-4" /> : 
                             severity === 'CRITICAL' ? <AlertCircle className="w-4 h-4" /> : 
                             <Info className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-none mb-1.5">
                              {format(new Date(log.occurredAt), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> {format(new Date(log.occurredAt), 'hh:mm:ss a')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">
                            {log.actorName ? log.actorName.charAt(0) : 'S'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{log.actorName || 'System'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {log.actorId?.slice(0, 8) || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                           <span className={`text-[11px] font-black uppercase tracking-widest self-start px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                              severity === 'SECURITY' ? 'bg-rose-600 text-white border-rose-600 shadow-xl shadow-rose-100' :
                              severity === 'CRITICAL' ? 'bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-100' :
                              'bg-white text-slate-600 border-slate-100 shadow-sm'
                           }`}>
                            {humanize(log.action)}
                            <ArrowRight className="w-3 h-3 opacity-50" />
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.1em] border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all cursor-pointer">
                          <Database className="w-3 h-3" /> {log.entityType}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {logs?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <Info className="w-12 h-12" />
                      <p className="text-lg font-black tracking-tight">No activities recorded yet</p>
                      <p className="text-sm font-medium text-slate-400">All system changes will appear here as they occur.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: any) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}:</span>
       <select 
         className="bg-transparent text-xs font-black text-indigo-600 outline-none cursor-pointer pr-2"
         value={value}
         onChange={(e) => onChange(e.target.value)}
       >
         {options.map((opt: string) => (
           <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
         ))}
       </select>
    </div>
  );
}
