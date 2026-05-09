import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { 
  Package, AlertTriangle, 
  Users, Activity, Clock,
  ClipboardList
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { StatusCard } from './components/DashboardCards';
import { useOutletContext } from 'react-router-dom';

const ManagerDashboard = memo(() => {
  const { filters } = useOutletContext<{ filters: any }>();
  const { data: inventory } = useQuery({ queryKey: ['inventory-alerts'], queryFn: async () => (await api.get('/inventory')).data });
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/master-data/lines')).data, staleTime: 10000 });

  const isLive = filters.timeRange === 'live';

  const getDates = () => {
    const end = new Date();
    const start = new Date();
    if (filters.timeRange === 'today') start.setHours(0,0,0,0);
    else if (filters.timeRange === 'week') start.setDate(start.getDate() - 7);
    else if (filters.timeRange === 'month') start.setDate(start.getDate() - 30);
    return { start, end };
  };

  const { start, end } = getDates();

  const { data: historicalData } = useQuery({
    queryKey: ['manager-historical', filters.timeRange],
    queryFn: async () => {
      if (isLive) return [];
      const res = await api.get('/analytics/historical', {
        params: { 
          startDate: start.toISOString(), 
          endDate: end.toISOString(),
          interval: filters.timeRange === 'today' ? 'hour' : 'day'
        }
      });
      return res.data.map((d: any) => ({
        name: filters.timeRange === 'today' ? new Date(d.time).getHours() + ':00' : new Date(d.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        value: Number(d.totalProduction)
      }));
    },
    enabled: !isLive
  });

  const activeLinesCount = lines?.filter((l:any) => l.status === 'RUNNING').length || 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-2xl">
              <ClipboardList className="w-7 h-7" />
            </div>
            Tactical Management
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1">Daily shift control, material logistics and floor health.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatusCard label="Active Lines" value={`${activeLinesCount}/${lines?.length || 0}`} subLabel="Standard Capacity" icon={Activity} color="indigo" />
        <StatusCard label="Material Risk" value={inventory?.filter((m:any)=>Number(m.quantity) <= Number(m.minimumStock)).length || 0} subLabel="Requires Attention" icon={Package} color="amber" />
        <StatusCard label="Team Status" value="---" subLabel="Attendance Score" icon={Users} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                 <Clock className="w-6 h-6 text-amber-500" />
                 Shift Throughput
              </h3>
              <span className="px-4 py-2 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                Target: 12,000 Units
              </span>
            </div>
            <div className="h-[300px] w-full flex flex-col" style={{ minWidth: 0, minHeight: 300 }}>
               <ResponsiveContainer width="100%" height="100%" debounce={50}>
                 <BarChart data={isLive ? [] : historicalData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                     cursor={{ fill: '#f8fafc' }}
                   />
                   <Bar dataKey="value" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Live Production Events</h3>
            <div className="space-y-4">
              <p className="text-slate-400 text-xs italic p-10 text-center bg-slate-50 rounded-3xl">No live production events recorded in the current shift.</p>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8">
               <AlertTriangle className="w-8 h-8 text-rose-500 animate-bounce" />
             </div>
             <h3 className="text-xl font-black mb-8">Inventory Watch</h3>
             <div className="space-y-6">
               {inventory?.filter((m:any) => Number(m.quantity) <= Number(m.minimumStock)).slice(0, 4).map((item: any) => (
                 <div key={item.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                   <p className="text-xs font-black uppercase text-amber-400 mb-1">{item.categoryName}</p>
                   <p className="text-sm font-bold mb-2">{item.itemName}</p>
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Stock: {item.quantity}</span>
                      <span className="text-rose-400">Low Stock</span>
                   </div>
                 </div>
               ))}
               {!inventory?.length && <p className="text-slate-500 text-xs italic">No critical alerts</p>}
             </div>
             <button className="w-full mt-8 py-4 bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20">
               Generate PO Request
             </button>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-10 relative overflow-hidden group">
             <div className="absolute top-6 right-6">
                <div className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[8px] font-black uppercase tracking-widest">Upcoming</div>
             </div>
             <h3 className="text-xl font-black text-slate-400 mb-4">Laboratory Sync</h3>
             <p className="text-slate-400 text-sm font-bold leading-relaxed mb-8">Real-time integration with chemical analysis and quality lab hardware.</p>
             <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-1/3 animate-pulse" />
             </div>
          </div>

          <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl">
             <h3 className="text-xl font-black mb-4">Daily Report</h3>
             <p className="text-indigo-100 text-sm font-bold mb-8 leading-relaxed">Your end-of-shift performance report is ready for review.</p>
             <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                View Analysis
             </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ManagerDashboard;
