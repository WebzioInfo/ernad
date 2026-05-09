import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { 
  BarChart4, TrendingUp, Users, Package, 
  ArrowUpRight, ArrowDownRight, CreditCard,
  Download, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';

export default function SalesAnalyticsPage() {
  const [dateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-report', dateRange],
    queryFn: async () => {
      const res = await api.get('/reports/sales', {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    }
  });

  if (isLoading) return <div className="h-96 flex items-center justify-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Processing Market Intelligence...</div>;

  const summary = salesData?.summary || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl">
              <BarChart4 className="w-8 h-8" />
            </div>
            Market Intelligence
          </h1>
          <p className="text-slate-500 font-bold mt-2 ml-1">Comprehensive revenue analytics and customer distribution matrix.</p>
        </div>
        <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-slate-100 shadow-sm">
           <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Period</span>
                <span className="text-sm font-black text-slate-700">{format(new Date(dateRange.start), 'MMM d')} - {format(new Date(dateRange.end), 'MMM d, yyyy')}</span>
              </div>
           </div>
           <button className="p-5 bg-slate-900 text-white rounded-3xl hover:bg-slate-800 transition-all shadow-xl active:scale-95">
              <Download className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard 
          label="Gross Revenue" 
          value={`$${(Number(summary.totalRevenue) / 1000).toFixed(1)}k`} 
          trend="+12.4%" 
          icon={TrendingUp} 
          color="emerald" 
        />
        <KPICard 
          label="Total Orders" 
          value={summary.orderCount} 
          trend="+8.1%" 
          icon={Package} 
          color="blue" 
        />
        <KPICard 
          label="Avg. Ticket Size" 
          value={`$${Math.round(summary.avgOrderValue)}`} 
          trend="-2.4%" 
          icon={CreditCard} 
          color="indigo" 
          negative 
        />
        <KPICard 
          label="Retention Rate" 
          value="88%" 
          trend="+5.0%" 
          icon={Users} 
          color="amber" 
        />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Revenue Chart */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-12">
             <div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Trajectory</h3>
               <p className="text-slate-500 font-bold text-sm">Monthly growth metrics across all distribution hubs.</p>
             </div>
             <div className="flex gap-2">
                <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">Live Forecast</div>
             </div>
           </div>
           <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={MOCK_REVENUE}>
                    <defs>
                       <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Top Products */}
        <div className="col-span-12 lg:col-span-4 bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
           <h3 className="text-xl font-black mb-10 flex items-center gap-3 relative z-10">
              <Package className="w-6 h-6 text-indigo-400" />
              SKU Performance
           </h3>
           <div className="space-y-6 relative z-10">
              {salesData?.topProducts?.map((prod: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                   <div>
                      <p className="text-sm font-black text-white">{prod.productName}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{prod.quantity.toLocaleString()} Units Sold</p>
                   </div>
                   <div className="text-right">
                      <p className="text-base font-black text-indigo-400 tracking-tighter">${(Number(prod.revenue)/1000).toFixed(1)}k</p>
                      <div className="w-16 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                         <div className="h-full bg-indigo-500" style={{ width: `${100 - idx * 15}%` }} />
                      </div>
                   </div>
                </div>
              ))}
           </div>
           <button className="w-full mt-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">
              Full Product Matrix
           </button>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, trend, icon: Icon, color, negative }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
        color === 'emerald' ? 'bg-emerald-500 text-white shadow-emerald-100' :
        color === 'blue' ? 'bg-blue-500 text-white shadow-blue-100' :
        color === 'indigo' ? 'bg-indigo-500 text-white shadow-indigo-100' :
        'bg-amber-500 text-white shadow-amber-100'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h4>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
          negative ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
        }`}>
          {negative ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
    </motion.div>
  );
}

const MOCK_REVENUE = [
  { name: 'Mon', value: 4500 },
  { name: 'Tue', value: 5200 },
  { name: 'Wed', value: 4800 },
  { name: 'Thu', value: 6100 },
  { name: 'Fri', value: 5900 },
  { name: 'Sat', value: 7200 },
  { name: 'Sun', value: 6800 },
];
