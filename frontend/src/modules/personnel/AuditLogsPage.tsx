import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { 
  ClipboardList, Clock, 
  Database, Info, Download,
  Search, AlertCircle, ShieldAlert,
  ArrowRight, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ENDPOINTS } from '../../constants/endpoints';

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
    queryFn: async () => (await api.get(ENDPOINTS.USERS.AUDIT_LOGS)).data,    retry: false
  });

  const getSeverity = (log: AuditLog) => {
    const action = (log.action || '').toUpperCase();
    const entity = (log.entityType || '').toUpperCase();
    
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
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'ALL' || getSeverity(log) === severityFilter;
    const matchesModule = moduleFilter === 'ALL' || log.entityType === moduleFilter;

    return matchesSearch && matchesSeverity && matchesModule;
  });

  const entities = Array.from(new Set(logs?.map(l => l.entityType))).filter(Boolean);

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Loading Compliance Logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
              <ClipboardList className="w-5 h-5 text-[#1A9A91]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-4">
              Audit Intelligence
            </h2>
          </div>
          <p className="text-slate-500 text-xs mt-1">Operational ledger tracking configuration changes, security events, and compliance logs.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-650 rounded-lg text-xs font-semibold shadow-sm justify-center">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live Sync
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export Ledger
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-200">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Refine</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
           <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
           <input 
             type="text" 
             placeholder="Search by operator, username, or action..." 
             className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Audit Table Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Time & Date</th>
                <th className="px-6 py-3.5">Performed By</th>
                <th className="px-6 py-3.5">Action Taken</th>
                <th className="px-6 py-3.5 text-right">Entity Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <AnimatePresence mode="popLayout">
                {filteredLogs?.map((log, idx) => {
                  const severity = getSeverity(log);
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                      key={log.id} 
                      className="hover:bg-slate-50/45 transition-colors group"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded border ${
                            severity === 'SECURITY' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            severity === 'CRITICAL' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-slate-50 text-slate-400 border-slate-200'
                          } group-hover:scale-105 transition-transform`}>
                            {severity === 'SECURITY' ? <ShieldAlert className="w-4 h-4" /> : 
                             severity === 'CRITICAL' ? <AlertCircle className="w-4 h-4" /> : 
                             <Info className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-none mb-1">
                              {format(new Date(log.occurredAt), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {format(new Date(log.occurredAt), 'hh:mm:ss a')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-slate-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {log.actorName ? log.actorName.charAt(0) : 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight">{log.actorName || 'System'}</p>
                            <p className="text-[10px] text-slate-400">ID: {log.actorId?.slice(0, 8) || 'System'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col gap-1">
                           <span className={`text-[11px] font-semibold uppercase tracking-wider self-start px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                              severity === 'SECURITY' ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm' :
                              severity === 'CRITICAL' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' :
                              'bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
                           }`}>
                            {humanize(log.action)}
                            <ArrowRight className="w-3 h-3 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold uppercase tracking-wide group-hover:bg-[#1A9A91] group-hover:text-white group-hover:border-[#1A9A91] transition-all cursor-pointer">
                          <Database className="w-3 h-3" /> {log.entityType}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filteredLogs?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Info className="w-8 h-8 text-slate-300" />
                      <p className="font-bold tracking-tight text-slate-700 text-sm">No compliance logs recorded</p>
                      <p className="text-xs text-slate-450">All platform operations and events appear here as they occur.</p>
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
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}:</span>
       <select 
         className="bg-transparent text-xs font-semibold text-[#1A9A91] outline-none cursor-pointer pr-1"
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

// Local fallback Loader2 svg
function Loader2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  );
}
