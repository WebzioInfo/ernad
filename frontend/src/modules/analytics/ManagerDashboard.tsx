import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { motion } from 'framer-motion';
import {
  Package, AlertTriangle,
  Users, Activity, Clock,
  ClipboardList, TrendingUp,
  Gauge, Layers, RefreshCw
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { StatusCard } from './components/DashboardCards';
import { useOutletContext } from 'react-router-dom';

const ManagerDashboard = memo(() => {
  const { filters } = useOutletContext<{ filters: any }>();

  // 1. Live Factory State
  const { data: factoryLive, refetch: refetchLive, isLoading: loadingLive } = useQuery({
    queryKey: ['factory-live-manager'],
    queryFn: async () => (await api.get('/analytics/factory/live')).data
  });

  // 2. Inventory Alerts
  const { data: inventory } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => (await api.get('/inventory')).data
  });

  const isLive = filters.timeRange === 'live';

  const getDates = () => {
    const end = new Date();
    const start = new Date();
    if (filters.timeRange === 'today') start.setHours(0, 0, 0, 0);
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

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4 uppercase italic">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-200">
              <ClipboardList className="w-7 h-7" />
            </div>
            Tactical Management
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live shop-floor oversight & material reconciliation.
          </p>
        </div>
        <button
          onClick={() => refetchLive()}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95 group"
        >
          <RefreshCw className={`w-4 h-4 ${loadingLive ? 'animate-spin text-indigo-500' : ''}`} />
          Sync Factory Data
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatusCard
          label="Current Output"
          value={factoryLive?.counters?.packing?.toLocaleString() || '0'}
          subLabel="Units Packed Today"
          icon={Activity}
          color="indigo"
          delay={0.1}
        />
        <StatusCard
          label="Active Batches"
          value={factoryLive?.activeBatches?.length || '0'}
          subLabel="Across All Lines"
          icon={Layers}
          color="amber"
          delay={0.2}
        />
        <StatusCard
          label="Global Yield"
          value={factoryLive?.counters?.blowing > 0 ? ((factoryLive?.counters?.packing / factoryLive?.counters?.blowing) * 100).toFixed(1) + '%' : '100%'}
          subLabel="Efficiency Score"
          icon={Gauge}
          color="emerald"
          delay={0.3}
        />
        <StatusCard
          label="Rejections"
          value={factoryLive?.counters?.rejection?.toLocaleString() || '0'}
          subLabel="Quality Failures"
          icon={AlertTriangle}
          color="rose"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8 space-y-10">
          {/* Active Batches Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-amber-500/10 transition-all duration-1000" />
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-500" />
                Active Batch Progress
              </h3>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Factory Live
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {!factoryLive?.activeBatches?.length && (
                <div className="py-20 text-center bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic">No batches currently active on the floor.</p>
                </div>
              )}
              {factoryLive?.activeBatches?.map((batch: any, i: number) => {
                const efficiency = 90 + Math.random() * 8; // Simulation for now
                const progress = 40 + Math.random() * 50;

                return (
                  <motion.div
                    key={batch.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + (i * 0.1) }}
                    className="p-8 bg-slate-50/80 backdrop-blur-sm rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-black text-xl text-indigo-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                          {batch.line?.split(' ')[1] || '1'}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{batch.batchCode}</p>
                          <p className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{batch.product}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficiency</p>
                        <p className="text-2xl font-black text-emerald-600 tracking-tighter">{efficiency.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Throughput Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Historical Trends */}
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
            <div className="flex justify-between items-center mb-10 relative z-10">
              <h3 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
                Throughput Velocity
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trend Synthesis</span>
              </div>
            </div>
            <div className="h-[300px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={isLive ? [] : historicalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', backgroundColor: '#1e293b', color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {isLive && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-white/5">
                  <p className="text-slate-400 font-bold italic">Historical view disabled in Live Mode.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-10">
          {/* Inventory Risk Rail */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-700">
              <Package className="w-32 h-32 text-indigo-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 relative z-10 flex items-center gap-3">
              <Package className="w-5 h-5 text-indigo-500" />
              Material Watch
            </h3>
            <p className="text-slate-500 font-bold text-sm mb-8 relative z-10 leading-relaxed">Active monitoring of raw material stocks and procurement requirements.</p>

            <div className="space-y-4 relative z-10">
              {inventory?.filter((m: any) => Number(m.quantity) <= Number(m.minimumStock)).slice(0, 4).map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + (i * 0.1) }}
                  className="p-5 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:border-amber-200 hover:bg-white transition-all cursor-pointer group/item"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">{item.categoryName}</p>
                    <div className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-md text-[8px] font-black">CRITICAL</div>
                  </div>
                  <p className="text-sm font-black text-slate-800 group-hover/item:text-indigo-600 transition-colors">{item.itemName}</p>
                  <div className="flex justify-between items-center mt-4 text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Current: <span className="text-slate-900">{item.quantity} {item.unit}</span></span>
                    <span className="text-slate-400">Min: <span className="text-slate-900">{item.minimumStock}</span></span>
                  </div>
                  <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.max(10, (Number(item.quantity) / Number(item.minimumStock)) * 100)}%` }}
                    />
                  </div>
                </motion.div>
              ))}
              {!inventory?.some((m: any) => Number(m.quantity) <= Number(m.minimumStock)) && (
                <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs font-bold italic">Stock levels optimal.</p>
                </div>
              )}
            </div>
            <button className="w-full mt-10 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95">
              Generate Inventory Report
            </button>
          </motion.div>

          {/* Manager Actions */}
          <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-200">
            <h3 className="text-xl font-black mb-4">Direct Intervention</h3>
            <p className="text-indigo-100 text-sm font-bold mb-8 leading-relaxed">Authorized override for batch correction, downtime categorization and floor staffing.</p>
            <div className="space-y-4">
              <button className="w-full py-4 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                Staffing Roster
              </button>
              <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl">
                Recalculate Batch Metrics
              </button>
            </div>
          </div>

          {/* Attendance Overview */}
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Users className="w-5 h-5 text-indigo-500" />
              Team Status
            </h3>
            <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Attendance Score</p>
                <p className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">92%</p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 flex items-center justify-center font-black text-xs">
                +4%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ManagerDashboard;
