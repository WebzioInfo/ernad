import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../../modules/auth/auth.store';
import {
  Activity, TrendingUp,
  Database, HardDrive, Cpu,
  Gauge, Clock, AlertTriangle,
  CheckCircle2, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { KPICard } from './components/DashboardCards';
import ManagerDashboard from './ManagerDashboard';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { useOutletContext } from 'react-router-dom';

export default function ExecutiveDashboard() {
  const { user } = useAuthStore();
  const { filters, setFilters } = useOutletContext<{ filters: any, setFilters: (f: any) => void }>();
  const userRoles = (user?.roles || [user?.role]).map(r => String(r).toUpperCase());
  const isManager = userRoles.includes('MANAGER');

  const renderDashboard = () => {
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

// Admin dashboard
const AdminDashboard = memo(({ filters }: { filters: any }) => {
  const { data: factoryLive, refetch: refetchLive } = useQuery({
    queryKey: ['factory-live-overview'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE)).data
  });

  const { data: efficiency } = useQuery({
    queryKey: ['machine-efficiency'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_EFFICIENCY)).data
  });

  const { data: salesSummary } = useQuery({
    queryKey: ['tally-sales-summary'],
    queryFn: async () => (await api.get(ENDPOINTS.TALLY.SUMMARY)).data
  });

  const isLive = filters.timeRange === 'live';

  const displayStats = {
    blowing: factoryLive?.counters?.blowing || 0,
    filling: factoryLive?.counters?.filling || 0,
    packing: factoryLive?.counters?.packing || 0,
    rejection: factoryLive?.counters?.rejection || 0,
    yield: factoryLive?.counters?.blowing > 0 ? ((factoryLive?.counters?.packing / factoryLive?.counters?.blowing) * 100).toFixed(1) : '100',
    totalSales: salesSummary?.totalSales || 0
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-10 pb-20"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-900 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200">
              <Activity className="w-9 h-9" />
            </div>
            Factory Control Center
          </h2>
          <p className="text-slate-500 font-bold mt-4 ml-1 text-lg flex items-center gap-2">
            {isLive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {isLive ? 'Live Industrial Terminal' : 'Historical Production Terminal'} • <span className="text-slate-400 font-medium">Synchronized across {efficiency?.length || 0} production lines</span>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-3 rounded-[2.5rem] shadow-2xl border border-slate-50">
          <button 
             onClick={() => refetchLive()}
             className="ml-2 w-12 h-12 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-2xl flex items-center justify-center transition-all group active:scale-90"
             title="Manual Sync"
           >
              <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
           </button>
          <div className="flex flex-col items-end px-8 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Yield</span>
            <span className="text-3xl font-black text-emerald-600">{displayStats.yield}%</span>
          </div>
          <div className="flex flex-col items-end px-8">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tally Sales (MTD)</span>
            <span className="text-3xl font-black text-indigo-600">${(Number(displayStats.totalSales) / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </header>

      {/* Main Industrial Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard label="Today's Blowing" value={displayStats.blowing.toLocaleString()} trend="+12.4%" icon={Gauge} color="blue" chartColor="#1A9A91" delay={0.1} />
        <KPICard label="Today's Filling" value={displayStats.filling.toLocaleString()} trend="+8.1%" icon={TrendingUp} color="emerald" chartColor="#10b981" delay={0.2} />
        <KPICard label="Today's Packing" value={displayStats.packing.toLocaleString()} trend="Optimal" icon={CheckCircle2} color="indigo" chartColor="#1A9A91" delay={0.3} />
        <KPICard label="Process Rejections" value={displayStats.rejection.toLocaleString()} trend="High" icon={Activity} color="rose" chartColor="#f43f5e" delay={0.4} />
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* Active Batches & Progress */}
        <div className="col-span-12 lg:col-span-8 space-y-10">
          <div className="bg-white rounded-[3.5rem] p-10 shadow-xl border border-slate-50 relative overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Database className="w-6 h-6 text-indigo-600" />
                Active Production Batches
              </h3>
              <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                {factoryLive?.activeBatches?.length || 0} Running
              </span>
            </div>

            <div className="space-y-6">
              {factoryLive?.activeBatches?.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold">No active batches on floor.</div>
              ) : (
                factoryLive?.activeBatches?.map((batch: any) => {
                  const elapsed = Math.round((new Date().getTime() - new Date(batch.startTime).getTime()) / 60000);
                  const netTime = Math.max(0, elapsed - (batch.totalDowntimeMins || 0));

                  return (
                    <div key={batch.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 group hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm font-black text-indigo-600">
                          {batch.line?.split(' ')[1] || '1'}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch: {batch.batchCode}</p>
                          <p className="text-lg font-black text-slate-900 truncate max-w-[200px]">{batch.product}</p>
                        </div>
                      </div>

                      <div className="flex-1 w-full md:max-w-md px-0 md:px-10">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>Production: <span className="text-slate-900">{Math.floor(netTime / 60)}h {netTime % 60}m</span></span>
                          </div>
                          {batch.totalDowntimeMins > 0 && (
                            <span className="text-rose-500">Stop: {batch.totalDowntimeMins}m</span>
                          )}
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${batch.totalDowntimeMins > 30 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: '65%' }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Elapsed</p>
                          <p className="text-xs font-bold text-slate-600">{Math.floor(elapsed / 60)}h {elapsed % 60}m</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${batch.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Machine Health Grid */}
          <div className="grid grid-cols-2 gap-8">
            {efficiency?.slice(0, 4).map((line: any) => (
              <div key={line.id} className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Line Efficiency</p>
                    <h4 className="text-xl font-black">{line.name}</h4>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${line.status === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {line.status}
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-black tracking-tighter">{line.efficiency}%</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">OEE</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Inventory Right Rail */}
        <div className="col-span-12 lg:col-span-4 space-y-10">
          <div className="bg-rose-500 rounded-[3rem] p-10 text-white shadow-2xl shadow-rose-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-20">
              <Cpu className="w-32 h-32" />
            </div>
            <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
              <HardDrive className="w-6 h-6" />
              Material Alerts
            </h3>
            <p className="text-white/60 font-bold text-sm mb-10 tracking-tight">Critical items requiring immediate inwarding.</p>

            <div className="space-y-4">
              {factoryLive?.lowStockAlerts?.length === 0 ? (
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest py-4">No low stock alerts.</p>
              ) : (
                factoryLive?.lowStockAlerts?.map((item: any) => (
                  <div key={item.id} className="p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black">{item.itemName}</p>
                      <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Min: {item.minimumStock} {item.unit}</p>
                    </div>
                    <span className="text-lg font-black">{item.quantity}</span>
                  </div>
                ))
              )}
            </div>

            {/* TEMP DISABLED - Future Admin Feature
            // Preserved for future implementation
            <button className="w-full mt-10 py-5 bg-white text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95">
              View Inventory Ledger
            </button>
            */}
          </div>

          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Latest Machine Stops
            </h3>
            <div className="space-y-6">
              {factoryLive?.latestStops?.length === 0 ? (
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center py-4">No recent stops recorded.</p>
              ) : (
                factoryLive?.latestStops?.map((stop: any) => (
                  <div key={stop.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${stop.duration ? 'bg-slate-200 text-slate-600' : 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
                        }`}>
                        {stop.duration ? `${stop.duration}m` : 'LIVE'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">{stop.reason.replace('_', ' ')}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stop.station} • {stop.batchCode}</p>
                      </div>
                    </div>
                    <Clock className="w-4 h-4 text-slate-300" />
                  </div>
                ))
              )}
            </div>
            {/* TEMP DISABLED - Future Admin Feature
            // Preserved for future implementation
            <button className="w-full mt-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              Full Downtime Analysis
            </button>
            */}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

