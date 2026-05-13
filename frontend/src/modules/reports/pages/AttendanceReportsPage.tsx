import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';
import { 
  ClipboardList, User, Download, 
  Calendar, CheckCircle2, AlertCircle, 
  Search, Filter
} from 'lucide-react';
import { format } from 'date-fns';

export default function AttendanceReportsPage() {
  const [dateRange, setDateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance-report', dateRange],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.REPORTS.ATTENDANCE, {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    }
  });

  if (isLoading) return <div className="h-96 flex items-center justify-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Synchronizing Biometric Ledger...</div>;

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex items-center gap-8">
           <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner">
              <ClipboardList className="w-8 h-8" />
           </div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Staff Attendance Ledger</h1>
              <p className="text-slate-500 font-bold mt-2">Historical biometric synchronization logs and shift compliance.</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-4 px-6 py-4 bg-slate-50 rounded-3xl border border-slate-100">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
              <span className="text-slate-300 font-bold">to</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
           </div>
           <button className="p-5 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all">
              <Download className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-125 transition-transform duration-500">
               <User className="w-20 h-20" />
            </div>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Total Records</p>
            <h4 className="text-4xl font-black">{attendanceData?.length || 0}</h4>
            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl w-fit">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">Verified Synced</span>
            </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Compliance Rate</p>
               <h4 className="text-3xl font-black text-slate-900">94.2%</h4>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 w-[94.2%]" />
            </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Hours/Shift</p>
               <h4 className="text-3xl font-black text-slate-900">7h 45m</h4>
            </div>
            <div className="flex gap-2">
               <div className="w-8 h-8 bg-slate-50 rounded-lg" />
               <div className="w-8 h-8 bg-slate-50 rounded-lg" />
               <div className="w-8 h-8 bg-slate-50 rounded-lg" />
               <div className="w-8 h-8 bg-indigo-100 rounded-lg" />
            </div>
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="relative">
               <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
               <input 
                 type="text" 
                 placeholder="Search personnel..." 
                 className="bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm w-80 focus:ring-2 focus:ring-indigo-100 transition-all font-bold"
               />
            </div>
            <button className="flex items-center gap-3 px-6 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all">
               <Filter className="w-4 h-4" />
               Detailed Filters
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/30">
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Worked Hours</th>
                     <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Compliance</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {attendanceData?.map((record: any, idx: number) => (
                     <tr key={idx} className="hover:bg-slate-50/30 transition-all group">
                        <td className="px-10 py-6">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                 {record.userName.charAt(0)}
                              </div>
                              <div>
                                 <p className="text-sm font-black text-slate-900">{record.userName}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{record.department || 'Production'}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-6 text-center">
                           <span className="text-sm font-bold text-slate-700">{format(new Date(record.date), 'MMM dd, yyyy')}</span>
                        </td>
                        <td className="px-10 py-6">
                           <div className="flex justify-center">
                              <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                 record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                 {record.status === 'PRESENT' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                 {record.status}
                              </span>
                           </div>
                        </td>
                        <td className="px-10 py-6 text-center">
                           <span className="text-lg font-black text-slate-900 tabular-nums tracking-tighter">{record.workedHours}h</span>
                        </td>
                        <td className="px-10 py-6">
                           <div className="flex justify-center">
                              {Number(record.lateMinutes) > 0 ? (
                                 <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Late: {record.lateMinutes}m</span>
                              ) : (
                                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Punctual</span>
                              )}
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
