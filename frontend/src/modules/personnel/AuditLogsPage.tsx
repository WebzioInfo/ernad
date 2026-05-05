import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { 
  ClipboardList, Search, User, Clock, 
  Database, Info, Calendar, Filter
} from 'lucide-react';
import { format } from 'date-fns';

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
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get('/users/audit-logs')).data,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const humanize = (action: string) => {
    if (!action) return 'Unknown Action';
    if (!action.includes(' /')) return action; // Already humanized

    const [method, url] = action.split(' ');
    if (!url) return action;

    if (url.includes('/users')) {
      if (method === 'DELETE') return 'Removed a user';
      if (method === 'PATCH' || method === 'PUT') return 'Updated a user';
      if (method === 'POST') return 'Added a new user';
    }
    if (url.includes('/master-data/lines')) {
      if (method === 'DELETE') return 'Removed a production line';
      if (method === 'PATCH' || method === 'PUT') return 'Updated line configuration';
      if (method === 'POST') return 'Added a new production line';
    }
    if (url.includes('/inventory')) return 'Updated inventory records';
    if (url.includes('/production-management/batches')) return 'Modified production batch';

    return `${method} operation on ${url.split('/')[2] || 'system'}`;
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            System Logs
          </h2>
          <p className="text-slate-500 font-medium mt-1">A list of everything that happened in the system.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </div>
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
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-sm">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none mb-1">
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
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs border border-indigo-100 shadow-sm shadow-indigo-100/50">
                        {log.actorName ? log.actorName.charAt(0) : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{log.actorName || 'System'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User ID: {log.actorId?.slice(0, 8) || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                       <span className="text-sm font-bold text-slate-700 bg-indigo-50/50 self-start px-3 py-1 rounded-lg border border-indigo-100 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-all">
                        {humanize(log.action)}
                      </span>
                      {log.entityId && (
                        <span className="text-[10px] text-slate-400 font-medium ml-1">Affected ID: {log.entityId}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                      <Database className="w-3 h-3" /> {log.entityType}
                    </span>
                  </td>
                </tr>
              ))}
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
