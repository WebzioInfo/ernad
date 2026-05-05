import React, { memo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import useAuthStore from '../../store/useAuthStore';
import { 
  Zap, Package, CheckCircle2, AlertTriangle, 
  Users, Activity, Box, Clock, TrendingUp,
  ArrowUpRight, ArrowDownRight, MoreVertical,
  ShieldCheck, Database, HardDrive, Cpu,
  UserCheck, ClipboardList, Gauge, Globe
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, 
  PieChart, Pie, Cell 
} from 'recharts';

const MOCK_CHART_DATA = [
  { name: '06:00', value: 400 },
  { name: '08:00', value: 300 },
  { name: '10:00', value: 600 },
  { name: '12:00', value: 800 },
  { name: '14:00', value: 500 },
  { name: '16:00', value: 900 },
  { name: '18:00', value: 1100 },
];

export default function ExecutiveDashboard() {
  const { user } = useAuthStore();
  const roles = user?.roles || [user?.role];
  
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');

  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (isAdmin) return <AdminDashboard />;
  if (isManager) return <ManagerDashboard />;

  return <AdminDashboard />; // Default fallback
}

// ─── SUPER ADMIN: THE CORE ARCHITECT VIEW ───
const SuperAdminDashboard = memo(() => {
  const { data: auditLogs } = useQuery({ queryKey: ['audit-logs-summary'], queryFn: async () => (await api.get('/users/audit-logs')).data });

  const humanize = useCallback((action: string) => {
    if (!action) return 'Unknown Action';
    if (!action.includes(' /')) return action; // Already humanized

    const [method, url] = action.split(' ');
    if (!url) return action;

    if (url.includes('/users')) {
      if (method === 'DELETE') return 'Permanently removed a user account';
      if (method === 'PATCH' || method === 'PUT') return 'Updated a user profile';
      if (method === 'POST') return 'Created a new staff account';
    }
    if (url.includes('/master-data/lines')) {
      if (method === 'DELETE') return 'Removed a production line';
      if (method === 'PATCH' || method === 'PUT') return 'Updated line configuration';
      if (method === 'POST') return 'Added a new production line';
    }
    if (url.includes('/inventory')) return 'Updated inventory records';
    if (url.includes('/production-management/batches')) return 'Modified production batch';

    return `${method} operation on ${url.split('/')[2] || 'system'}`;
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-2xl">
              <ShieldCheck className="w-7 h-7" />
            </div>
            Core System Control
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1">Enterprise-level infrastructure oversight and security audits.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatusCard label="System Integrity" value="OPTIMAL" subLabel="No threats detected" icon={ShieldCheck} color="emerald" />
        <StatusCard label="Database Health" value="99.9%" subLabel="Latency: 12ms" icon={Database} color="indigo" />
        <StatusCard label="Cloud Resources" value="42%" subLabel="Storage usage" icon={HardDrive} color="blue" />
        <StatusCard label="Compute Load" value="18%" subLabel="Worker node status" icon={Cpu} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-400" />
            Security Live-Feed
          </h3>
          <div className="space-y-4">
             {auditLogs?.slice(0, 5).map((log: any) => (
               <div key={log.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                 <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{humanize(log.action)}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(log.occurredAt).toLocaleTimeString()}</p>
                  </div>
                 <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full uppercase tracking-widest">
                   {log.entityType}
                 </span>
               </div>
             ))}
          </div>
          <button className="w-full mt-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
            View Full Security Ledger
          </button>
        </div>

        <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
           <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-widest">Planned</div>
           <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto opacity-40">
                <Globe className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight opacity-40">Logistics Oversight</h3>
              <p className="text-slate-500 font-bold max-w-sm mx-auto opacity-40">Global supply chain tracking and multi-site factory synchronization.</p>
              <div className="pt-4">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-100 px-4 py-2 rounded-xl">Coming Soon</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
});

// ─── ADMIN: THE OPERATIONAL COMMAND VIEW ───
const AdminDashboard = memo(() => {
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/factory-config/lines')).data });
  const { data: personnel } = useQuery({ queryKey: ['personnel-stats'], queryFn: async () => (await api.get('/users')).data });

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-2xl">
              <TrendingUp className="w-7 h-7" />
            </div>
            Operational Command
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1">Plant-wide KPI performance and operational efficiency oversight.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard label="Global OEE" value="84.2%" trend="+3.1%" icon={Gauge} color="emerald" chartColor="#10b981" />
        <KPICard label="Active Staff" value={`${personnel?.length || 0}`} trend="Stable" icon={UserCheck} color="blue" chartColor="#3b82f6" />
        <KPICard label="Quality Yield" value="99.4%" trend="+0.1%" icon={CheckCircle2} color="indigo" chartColor="#6366f1" />
        <KPICard label="Production Runs" value={`${lines?.filter((l:any)=>l.status==='RUNNING').length || 0}`} trend="Max Cap" icon={Activity} color="amber" chartColor="#f59e0b" />
      </div>

      <div className="bg-white/50 backdrop-blur-xl rounded-[3rem] p-10 border border-white shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
        <div className="flex justify-between items-center mb-10 relative z-10">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Supply Chain Intelligence</h3>
          <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Coming Soon</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 opacity-30 pointer-events-none grayscale">
           {[1, 2, 3].map((i) => (
             <div key={i} className="h-48 bg-slate-100 rounded-[2.5rem] border border-slate-200 flex items-center justify-center">
                <Box className="w-10 h-10 text-slate-300" />
             </div>
           ))}
        </div>
        <div className="mt-10 text-center relative z-10">
          <p className="text-slate-400 font-bold text-sm">Predictive material procurement and automated vendor logistics are currently in development.</p>
        </div>
      </div>
    </div>
  );
});

// ─── MANAGER: THE TACTICAL FLOOR VIEW ───
const ManagerDashboard = memo(() => {
  const { data: inventory } = useQuery({ queryKey: ['inventory-alerts'], queryFn: async () => (await api.get('/inventory')).data });
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/factory-config/lines')).data });

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
        <StatusCard label="Material Risk" value={inventory?.filter((m:any)=>Number(m.currentStock) <= Number(m.minimumStock)).length || 0} subLabel="Requires Attention" icon={Package} color="amber" />
        <StatusCard label="Team Status" value="88%" subLabel="Attendance Score" icon={Users} color="emerald" />
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
                 <BarChart data={MOCK_CHART_DATA}>
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
              {[
                { time: '10 mins ago', event: 'Batch Completed: KEN-1L', line: 'Line 1', type: 'success' },
                { time: '25 mins ago', event: 'Changeover Started', line: 'Line 2', type: 'warning' },
                { time: '45 mins ago', event: 'Quality Check Passed', line: 'Line 1', type: 'success' },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className={`w-3 h-3 rounded-full ${e.type === 'success' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{e.event}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.line} • {e.time}</p>
                  </div>
                  <button className="p-2 hover:bg-white rounded-xl transition-colors">
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ))}
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
               {inventory?.filter((m:any) => Number(m.currentStock) <= Number(m.minimumStock)).slice(0, 4).map((item: any) => (
                 <div key={item.id} className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                   <p className="text-xs font-black uppercase text-amber-400 mb-1">{item.category}</p>
                   <p className="text-sm font-bold mb-2">{item.name}</p>
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Stock: {item.currentStock}</span>
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

// ─── REUSABLE COMPONENTS ───

const KPICard = memo(({ label, value, trend, icon: Icon, color, chartColor, negativeTrend }: any) => {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm group hover:scale-[1.02] transition-all duration-500 cursor-pointer relative overflow-hidden">
      <div className="flex justify-between items-start relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
          color === 'blue' ? 'bg-blue-50 text-blue-600' :
          color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
          'bg-amber-50 text-amber-600'
        }`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
          negativeTrend ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
        }`}>
          {negativeTrend ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div className="mt-8 relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h4>
      </div>
      <div className="absolute bottom-0 left-0 right-0 w-full h-16 opacity-10 group-hover:opacity-20 transition-opacity flex flex-col" style={{ minWidth: 0, minHeight: 64 }}>
         <ResponsiveContainer width="100%" height="100%" debounce={50}>
           <AreaChart data={MOCK_CHART_DATA}>
             <Area type="monotone" dataKey="value" stroke="none" fill={chartColor} />
           </AreaChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
});

const StatusCard = memo(({ label, value, subLabel, icon: Icon, color }: any) => {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
        color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
        color === 'blue' ? 'bg-blue-50 text-blue-600' :
        'bg-amber-50 text-amber-600'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
      <p className="text-xs font-bold text-slate-400 mt-1">{subLabel}</p>
    </div>
  );
});
