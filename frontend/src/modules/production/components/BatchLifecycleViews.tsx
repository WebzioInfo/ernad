import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Package,
  MapPin,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';


export function BatchTrackingView() {
  const { data: batches, isLoading } = useQuery({
    queryKey: ['production-batches'],
    queryFn: async () => {
      const res = await api.get('/production/batches');
      return res.data;
    },
  });

  if (isLoading) return <div className="p-10 text-center text-slate-400">Loading batches...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">Batch Info</th>
            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">Line</th>
            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-wider">Timing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {batches?.map((item: any) => (
            <tr key={item?.batch?.id || Math.random()} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-8 py-6">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900">{item?.batch?.batchCode || 'N/A'}</span>
                  <span className="text-xs font-medium text-slate-500">{item?.brand?.name || 'N/A'} - {item?.product?.name || 'N/A'}</span>
                </div>
              </td>
              <td className="px-8 py-6 text-sm font-bold text-slate-700">{item?.line?.name || 'N/A'}</td>
              <td className="px-8 py-6">
                <span className={`
                  px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest
                  ${item?.batch?.status === 'RUNNING' ? 'bg-emerald-50 text-emerald-600' : 
                    item?.batch?.status === 'QC_PENDING' ? 'bg-amber-50 text-amber-600' :
                    item?.batch?.status === 'COMPLETED' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}
                `}>
                  {item?.batch?.status || 'UNKNOWN'}
                </span>
              </td>
              <td className="px-8 py-6">
                <div className="flex flex-col gap-1 text-[11px] font-medium text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {item?.batch?.startTime ? format(new Date(item.batch.startTime), 'MMM d, HH:mm') : 'N/A'}
                  </div>
                  {item?.batch?.endTime && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <CheckCircle2 className="w-3 h-3 text-indigo-500" />
                      {format(new Date(item.batch.endTime), 'MMM d, HH:mm')}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QualityCheckView() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['qc-logs'],
    queryFn: async () => {
      const res = await api.get('/production/logs/qc');
      return res.data;
    },
  });

  if (isLoading) return <div className="p-10 text-center text-slate-400">Loading QC data...</div>;

  return (
    <div className="p-8 space-y-6">
      {logs?.map((log: any) => (
        <div key={log.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${log.result === 'PASS' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              {log.result === 'PASS' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">QC Inspection: {log.result}</div>
              <div className="text-xs font-medium text-slate-500">Inspector ID: {log.inspectorId} • {format(new Date(log.checkedAt), 'MMM d, HH:mm')}</div>
            </div>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100">
            Batch Reference: {log?.batchId?.slice(0, 8) || 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PackagingView() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['packaging-logs'],
    queryFn: async () => {
      const res = await api.get('/production/logs/packaging');
      return res.data;
    },
  });

  if (isLoading) return <div className="p-10 text-center text-slate-400">Loading packaging data...</div>;

  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {logs?.map((log: any) => (
        <div key={log.id} className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{log.packType}</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{log.quantity} <span className="text-lg text-slate-400">Packs</span></div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{log.unitsPerPack} Units/Pack</span>
            <span>{format(new Date(log.createdAt), 'HH:mm')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DispatchView() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['dispatch-logs'],
    queryFn: async () => {
      const res = await api.get('/production/logs/dispatch');
      return res.data;
    },
  });

  if (isLoading) return <div className="p-10 text-center text-slate-400">Loading dispatch data...</div>;

  return (
    <div className="p-8 space-y-4">
      {logs?.map((log: any) => (
        <div key={log.id} className="group relative overflow-hidden bg-white border border-slate-100 rounded-[2rem] p-8 hover:border-indigo-200 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Truck className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-3 h-3 text-rose-500" />
                  <span className="text-sm font-black text-slate-900">{log.destination}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                  <span className="flex items-center gap-1.5"><Package className="w-3 h-3" /> {log.quantity} Units</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {format(new Date(log.dispatchedAt), 'MMM d')}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 rounded-2xl text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vehicle No</div>
              <div className="text-sm font-black text-slate-900">{log.vehicleNumber}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
