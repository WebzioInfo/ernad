import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import useAuthStore from '../../modules/auth/auth.store';
import { 
  CheckCircle2, 
  Activity, TrendingUp,
  ShieldCheck, Database, HardDrive, Cpu,
  UserCheck, Gauge
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { StatusCard, KPICard, HealthMetric } from './components/DashboardCards';
import ManagerDashboard from './ManagerDashboard';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { useOutletContext } from 'react-router-dom';

export default function ExecutiveDashboard() {
  const { user } = useAuthStore();
  const { filters, setFilters } = useOutletContext<{ filters: any, setFilters: (f: any) => void }>();
  const roles = user?.roles || [user?.role];
  
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isManager = roles.includes('MANAGER');

  const renderDashboard = () => {
    if (isSuperAdmin) return <SuperAdminDashboard />;
    if (isManager) return <ManagerDashboard />;
    return <AdminDashboard filters={filters} />;
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-center mb-10">
        <TimeRangeSelector 
          value={filters.timeRange} 
          onChange={(val) => setFilters({ timeRange: val })} 
        />
      </div>
      {renderDashboard()}
    </div>
  );
}

// ─── SUPER ADMIN: THE CORE ARCHITECT VIEW ───
const SuperAdminDashboard = memo(() => {
  const { data: auditLogs } = useQuery({ queryKey: ['audit-logs-summary'], queryFn: async () => (await api.get('/users/audit-logs')).data });
  const { data: salesKpis } = useQuery({ 
    queryKey: ['sales-summary-global'], 
    queryFn: async () => (await api.get('/reports/sales', { 
      params: { 
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), 
        endDate: new Date().toISOString() 
      } 
    })).data 
  });

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
          className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 border border-slate-100 shadow-xl relative overflow-hidden group"
        >
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-50" />
           <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Financial Performance</h3>
              <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">30D Matrix</div>
           </div>
           
           <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                 <p className="text-3xl font-black text-slate-900 tracking-tighter">${(Number(salesKpis?.summary?.totalRevenue || 0) / 1000).toFixed(1)}k</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Ticket</p>
                 <p className="text-3xl font-black text-slate-900 tracking-tighter">${Math.round(salesKpis?.summary?.avgOrderValue || 0)}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orders</p>
                 <p className="text-3xl font-black text-slate-900 tracking-tighter">{salesKpis?.summary?.orderCount || 0}</p>
              </div>
              <div className="p-6 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100 text-white">
                 <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Top SKU</p>
                 <p className="text-xl font-black truncate">{salesKpis?.topProducts?.[0]?.productName || 'N/A'}</p>
              </div>
           </div>

           <div className="mt-8 pt-8 border-t border-slate-100 relative z-10">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                 <span>Revenue Goal</span>
                 <span className="text-indigo-600">72%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 w-[72%]" />
              </div>
           </div>
        </motion.div>
      </div>
    </motion.div>
  );
});

// ─── ADMIN: THE OPERATIONAL COMMAND VIEW ───
const AdminDashboard = memo(({ filters }: { filters: any }) => {
  const { data: lines } = useQuery({ queryKey: ['lines-status'], queryFn: async () => (await api.get('/master-data/lines')).data, staleTime: 10000 });
  const { data: personnel } = useQuery({ queryKey: ['personnel-stats'], queryFn: async () => (await api.get('/users')).data });

  const isLive = filters.timeRange === 'live';
  
  // Calculate date range based on filters
  const getDates = () => {
    const end = new Date();
    const start = new Date();
    if (filters.timeRange === 'today') start.setHours(0,0,0,0);
    else if (filters.timeRange === 'week') start.setDate(start.getDate() - 7);
    else if (filters.timeRange === 'month') start.setDate(start.getDate() - 30);
    return { start, end };
  };

  const { start, end } = getDates();

  const { data: kpis } = useQuery({
    queryKey: ['aggregated-kpis', filters.timeRange],
    queryFn: async () => {
      if (isLive) return null;
      const res = await api.get('/analytics/kpis', {
        params: { startDate: start.toISOString(), endDate: end.toISOString() }
      });
      return res.data;
    },
    enabled: !isLive
  });

  const { data: chartData } = useQuery({
    queryKey: ['historical-performance', filters.timeRange],
    queryFn: async () => {
      if (isLive) return null;
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

  const displayStats = {
    throughput: kpis?.throughput ? (Number(kpis.throughput) / 1000).toFixed(1) + 'k' : '0k',
    oee: kpis?.oee || 0,
    quality: kpis?.quality || 0,
    activeLines: lines?.filter((l: any) => l.status === 'RUNNING').length || 0,
    performance: kpis?.performance || 0
  };

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
          <p className="text-slate-500 font-bold mt-4 ml-1 text-lg">
            {isLive ? 'Real-time tactical oversight of global production efficiency.' : `Historical performance analysis for ${filters.timeRange}.`}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-xl border border-slate-50">
           <div className="flex flex-col items-end px-6 border-r border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isLive ? 'Global OEE' : 'Avg OEE'}</span>
              <span className="text-2xl font-black text-emerald-600">{displayStats.oee}%</span>
           </div>
           <div className="flex flex-col items-end px-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isLive ? 'Live Capacity' : 'Availability'}</span>
              <span className="text-2xl font-black text-indigo-600">{displayStats.performance}%</span>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard label="Line Throughput" value={displayStats.throughput} trend={isLive ? "+5.2%" : "Aggregated"} icon={Gauge} color="emerald" chartColor="#10b981" delay={0.1} />
        <KPICard label="Staff Allocation" value={`${personnel?.length || 0}`} trend="Optimal" icon={UserCheck} color="blue" chartColor="#3b82f6" delay={0.2} />
        <KPICard label="Quality Compliance" value={`${displayStats.quality}%`} trend={isLive ? "+0.2%" : "Average"} icon={CheckCircle2} color="indigo" chartColor="#6366f1" delay={0.3} />
        <KPICard label="Active Cycles" value={`${displayStats.activeLines}`} trend={isLive ? "Peak" : "Total Sessions"} icon={Activity} color="amber" chartColor="#f59e0b" delay={0.4} />
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
               <h3 className="text-3xl font-black text-slate-900 tracking-tight">Efficiency Trends</h3>
               <p className="text-slate-500 font-bold text-sm">
                 {isLive ? 'Aggregated performance data across all active lines.' : `Output performance over ${filters.timeRange}.`}
               </p>
             </div>
             <div className="flex items-center gap-2">
                <span className={`w-3 h-3 ${isLive ? 'bg-indigo-500 animate-ping' : 'bg-slate-300'} rounded-full`} />
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{isLive ? 'Live Updates' : 'Historical Data'}</span>
             </div>
           </div>
           
           <div className="h-[400px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData || []}>
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
              {(!chartData?.length && !isLive) && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">
                  No data available for this range.
                </div>
              )}
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

