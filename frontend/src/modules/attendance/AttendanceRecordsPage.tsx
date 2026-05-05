import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { 
  Clock, RefreshCw, CheckCircle2, AlertCircle, User, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  userName: string;
  userJob: string;
  clockIn: string;
  clockOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
  shift: string;
}

export default function AttendanceRecordsPage() {
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance'],
    queryFn: async () => (await api.get('/attendance/all')).data
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/attendance/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance records synchronized');
    }
  });

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-bold uppercase tracking-widest text-[10px]">Synchronizing Records...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Personnel Attendance</h2>
           <p className="text-slate-500 font-medium">Daily clock-in/out records from biometric systems.</p>
        </div>
        <button 
           onClick={() => syncMutation.mutate()}
           disabled={syncMutation.isPending}
           className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
        >
           {syncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
           Sync Biometrics
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-start mb-4">
               <CheckCircle2 className="w-8 h-8 text-emerald-500" />
               <span className="text-2xl font-black text-emerald-600">{records?.filter(r=>r.status==='PRESENT').length}</span>
            </div>
            <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Present Today</p>
         </div>
         <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-start mb-4">
               <Clock className="w-8 h-8 text-amber-500" />
               <span className="text-2xl font-black text-amber-600">{records?.filter(r=>r.status==='LATE').length}</span>
            </div>
            <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">Late Arrivals</p>
         </div>
         <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-start mb-4">
               <AlertCircle className="w-8 h-8 text-rose-500" />
               <span className="text-2xl font-black text-rose-600">{records?.filter(r=>r.status==='ABSENT').length}</span>
            </div>
            <p className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest">Absent</p>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift / Status</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock In</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock Out</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {records?.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/30 transition-all group">
                     <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                              <User className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="text-sm font-black text-slate-900">{record.userName}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.userJob || 'Operator'}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-10 py-6">
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-bold text-slate-600">{record.shift}</span>
                           <span className={`w-fit px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-600' :
                              record.status === 'LATE' ? 'bg-amber-100 text-amber-600' :
                              'bg-rose-100 text-rose-600'
                           }`}>
                              {record.status}
                           </span>
                        </div>
                     </td>
                     <td className="px-10 py-6">
                        <p className="text-sm font-black text-slate-700">{format(new Date(record.clockIn), 'HH:mm')}</p>
                        <p className="text-[10px] font-bold text-slate-400">{format(new Date(record.clockIn), 'MMM dd, yyyy')}</p>
                     </td>
                     <td className="px-10 py-6">
                        {record.clockOut ? (
                           <>
                              <p className="text-sm font-black text-slate-700">{format(new Date(record.clockOut), 'HH:mm')}</p>
                              <p className="text-[10px] font-bold text-slate-400">{format(new Date(record.clockOut), 'MMM dd, yyyy')}</p>
                           </>
                        ) : (
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Still Active</span>
                        )}
                     </td>
                  </tr>
               ))}
               {records?.length === 0 && (
                  <tr>
                     <td colSpan={4} className="px-10 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                        No records found. Click "Sync" to fetch data.
                     </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
