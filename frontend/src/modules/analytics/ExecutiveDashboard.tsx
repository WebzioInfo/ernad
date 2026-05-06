import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import useAuthStore from '../../store/useAuthStore';
import { 
  Package, CheckCircle2, AlertTriangle, 
  Users, Activity, Clock, TrendingUp,
  ArrowUpRight, ArrowDownRight, MoreVertical,
  ShieldCheck, Database, HardDrive, Cpu,
  UserCheck, ClipboardList, Gauge, Globe
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { motion } from 'framer-motion';

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
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
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm">
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              API: Online
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
              DB: 12ms
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatusCard label="System Integrity" value="OPTIMAL" subLabel="No threats detected" icon={ShieldCheck} color="emerald" delay={0.1} />
        <StatusCard label="Database Health" value="99.9%" subLabel="Transactional Lock: 0" icon={Database} color="indigo" delay={0.2} />
        <StatusCard label="Cloud Resources" value="42%" subLabel="Storage usage" icon={HardDrive} color="blue" delay={0.3} />
        <StatusCard label="Compute Load" value="18%" subLabel="Worker node status" icon={Cpu} color="amber" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-700" />
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3 relative z-10">
            <Activity className="w-6 h-6 text-indigo-400" />
            Security Live-Feed
          </h3>
          <div className="space-y-4 relative z-10">
             {auditLogs?.slice(0, 5).map((log: any, i: number) => (
               <motion.div 
                 key={log.id} 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.6 + (i * 0.1) }}
                 className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                >
                 <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                  <div className="flex-1">
                    <p className="text-sm font-bold truncate max-w-[250px]">{log.action}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(log.occurredAt).toLocaleTimeString()}</p>
                  </div>
                 <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full uppercase tracking-widest">
                   {log.entityType}
                 </span>
               </motion.div>
             ))}
          </div>
          <button className="w-full mt-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-900/40 relative z-10 active:scale-95">
            View Full Security Ledger
          </button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 border border-slate-100 shadow-xl flex flex-col justify-center relative overflow-hidden group"
        >
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-50" />
           <div className="absolute top-8 right-8 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">Planned</div>
           <div className="text-center space-y-6 relative z-10">
              <div className="w-24 h-24 bg-white shadow-xl rounded-[2rem] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                <Globe className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Logistics War Room</h3>
              <p className="text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">Global supply chain tracking and multi-site factory synchronization with AI-driven procurement.</p>
              <div className="pt-4">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] border border-indigo-100 px-6 py-3 rounded-2xl bg-white shadow-sm">Development Phase 3</span>
              </div>
           </div>
        </motion.div>
      </div>
    </motion.div>
  );
});

// ─── ADMIN: THE OPERATIONAL COMMAND VIEW ───
const AdminDashboard = memo(() => {
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/master-data/lines')).data, staleTime: 10000 });
  const { data: personnel } = useQuery({ queryKey: ['personnel-stats'], queryFn: async () => (await api.get('/users')).data });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-10"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200">
              <TrendingUp className="w-9 h-9" />
            </div>
            Factory War Room
          </h2>
          <p className="text-slate-500 font-bold mt-4 ml-1 text-lg">Real-time tactical oversight of global production efficiency.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-xl border border-slate-50">
           <div className="flex flex-col items-end px-6 border-r border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global OEE</span>
              <span className="text-2xl font-black text-emerald-600">84.2%</span>
           </div>
           <div className="flex flex-col items-end px-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Capacity</span>
              <span className="text-2xl font-black text-indigo-600">92%</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard label="Line Throughput" value="128.4k" trend="+5.2%" icon={Gauge} color="emerald" chartColor="#10b981" delay={0.1} />
        <KPICard label="Staff Allocation" value={`${personnel?.length || 0}`} trend="Optimal" icon={UserCheck} color="blue" chartColor="#3b82f6" delay={0.2} />
        <KPICard label="Quality Compliance" value="99.8%" trend="+0.2%" icon={CheckCircle2} color="indigo" chartColor="#6366f1" delay={0.3} />
        <KPICard label="Active Cycles" value={`${lines?.filter((l:any)=>l.status==='RUNNING').length || 0}`} trend="Peak" icon={Activity} color="amber" chartColor="#f59e0b" delay={0.4} />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-12 lg:col-span-8 bg-white/40 backdrop-blur-3xl rounded-[4rem] p-12 border border-white shadow-2xl relative overflow-hidden"
        >
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
           <div className="flex justify-between items-center mb-12 relative z-10">
             <div>
               <h3 className="text-3xl font-black text-slate-900 tracking-tight">OEE Efficiency Trends</h3>
               <p className="text-slate-500 font-bold text-sm">Aggregated performance data across all active lines.</p>
             </div>
             <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Live Updates</span>
             </div>
           </div>
           
           <div className="h-[400px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={MOCK_CHART_DATA}>
                    <defs>
                       <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '2rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '1.5rem' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorOee)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="col-span-12 lg:col-span-4 space-y-8"
        >
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                 <ShieldCheck className="w-32 h-32" />
              </div>
              <div>
                <h3 className="text-2xl font-black mb-2">Factory Health</h3>
                <p className="text-slate-400 font-bold text-sm mb-10">Global infrastructure diagnostics.</p>
                
                <div className="space-y-6">
                   <HealthMetric label="API Gateway" status="Operational" score={99} />
                   <HealthMetric label="Database Latency" status="12ms" score={100} />
                   <HealthMetric label="IoT Heartbeat" status="Active" score={85} />
                   <HealthMetric label="Cloud Sync" status="Synchronized" score={95} />
                </div>
              </div>
              
              <button className="w-full mt-12 py-5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-400 hover:text-white transition-all active:scale-95">
                 Run Deep Diagnostics
              </button>
           </div>
        </motion.div>
      </div>
    </motion.div>
  );
});

const HealthMetric = ({ label, status, score }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
     <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-white">{status}</p>
     </div>
     <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
        score > 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
     }`}>
        {score}%
     </div>
  </div>
);

// ─── MANAGER: THE TACTICAL FLOOR VIEW ───
const ManagerDashboard = memo(() => {
  const { data: inventory } = useQuery({ queryKey: ['inventory-alerts'], queryFn: async () => (await api.get('/inventory')).data });
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/master-data/lines')).data, staleTime: 10000 });

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

const KPICard = memo(({ label, value, trend, icon: Icon, color, chartColor, negativeTrend, delay = 0 }: any) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5 }}
      className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-xl group cursor-pointer relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent pointer-events-none" />
      <div className="flex justify-between items-start relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
          color === 'emerald' ? 'bg-emerald-500 text-white shadow-emerald-200' :
          color === 'blue' ? 'bg-blue-500 text-white shadow-blue-200' :
          color === 'indigo' ? 'bg-indigo-500 text-white shadow-indigo-200' :
          'bg-amber-500 text-white shadow-amber-200'
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
        <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</h4>
      </div>
      <div className="absolute bottom-0 left-0 right-0 w-full h-16 opacity-10 group-hover:opacity-25 transition-opacity" style={{ minWidth: 0 }}>
         <ResponsiveContainer width="100%" height="100%">
           <AreaChart data={MOCK_CHART_DATA}>
             <Area type="monotone" dataKey="value" stroke="none" fill={chartColor} />
           </AreaChart>
         </ResponsiveContainer>
      </div>
    </motion.div>
  );
});

const StatusCard = memo(({ label, value, subLabel, icon: Icon, color, delay = 0 }: any) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-xl relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50/50 opacity-50" />
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10 shadow-2xl transition-transform group-hover:rotate-12 ${
        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
        color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
        color === 'blue' ? 'bg-blue-50 text-blue-600' :
        'bg-amber-50 text-amber-600'
      }`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{value}</h4>
        <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
           {subLabel}
        </p>
      </div>
    </motion.div>
  );
});
