import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import { motion } from 'framer-motion';
import {
  Package, AlertTriangle,
  Users, Activity, Clock,
  Layers, RefreshCw, LayoutDashboard,
  Play, BarChart3,
  History, ShieldCheck, Gauge,
  ChevronRight, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import useAuthStore from '../auth/auth.store';

const ManagerDashboard = memo(() => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const roleBase = user?.role?.toLowerCase() === 'manager' ? '/manager' : '/admin';

  // Parallel Fetching with Independent Error Handling
  const factoryQuery = useQuery({
    queryKey: ['factory-live-manager'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE)).data,
    refetchInterval: 30000,
    retry: 1
  });

  const machineQuery = useQuery({
    queryKey: ['machine-efficiency'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_EFFICIENCY)).data,
    retry: 1,
    staleTime: 60000
  });

  const avgEfficiency = useMemo(() => {
    if (!machineQuery.data || machineQuery.data.length === 0) return 0;
    const sum = machineQuery.data.reduce((acc: number, m: any) => acc + (m.efficiency || 0), 0);
    return Math.round(sum / machineQuery.data.length);
  }, [machineQuery.data]);

  const alerts = useMemo(() => {
    const list = [];
    if (factoryQuery.data?.activeDowntimes?.length > 0) {
      list.push({ type: 'DOWNTIME', count: factoryQuery.data.activeDowntimes.length, label: 'Active Stops', color: 'rose' });
    }
    if (factoryQuery.data?.lowStockAlerts?.length > 0) {
      list.push({ type: 'STOCK', count: factoryQuery.data.lowStockAlerts.length, label: 'Low Stock', color: 'amber' });
    }
    return list;
  }, [factoryQuery.data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* ─── 1. HERO SUMMARY SECTION ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <CompactKPICard label="Active Lines" value={factoryQuery.isLoading ? '...' : (factoryQuery.data?.summary?.activeLinesCount || 0)} icon={Activity} color="indigo" />
        <CompactKPICard label="Running Batches" value={factoryQuery.isLoading ? '...' : (factoryQuery.data?.activeBatches?.length || 0)} icon={Layers} color="blue" />
        <CompactKPICard label="Machine OEE" value={machineQuery.isLoading ? '...' : `${avgEfficiency}%`} icon={Gauge} color="emerald" sub="Avg" isAlert={machineQuery.isError} />
        <CompactKPICard label="Units Packed" value={factoryQuery.isLoading ? '...' : (factoryQuery.data?.counters?.packing?.toLocaleString() || 0)} icon={Package} color="slate" />
        <CompactKPICard label="System Alerts" value={factoryQuery.isLoading ? '...' : alerts.reduce((a, b) => a + b.count, 0)} icon={AlertTriangle} color="rose" isAlert={alerts.length > 0 || factoryQuery.isError} />
        <CompactKPICard label="Staff Active" value={factoryQuery.isLoading ? '...' : (factoryQuery.data?.summary?.activeOperatorsCount || 0)} icon={Users} color="cyan" />
        <CompactKPICard label="Downtime Today" value={factoryQuery.isLoading ? '...' : `${factoryQuery.data?.summary?.totalDowntimeToday || 0}m`} icon={Clock} color="amber" />
      </div>

      <div className="grid grid-cols-12 gap-8">

        {/* Left Column: Actions & Pipeline */}
        <div className="col-span-12 lg:col-span-8 space-y-8">

          {/* ─── 2. QUICK ACTION ZONE ─── */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Strategic Interventions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ActionTile icon={LayoutDashboard} label="Production Floor" path={`${roleBase}/production`} color="indigo" />
              <ActionTile icon={Play} label="Start New Batch" path={`${roleBase}/production?action=start`} color="emerald" />
              <ActionTile icon={BarChart3} label="OEE Analytics" path={`${roleBase}/analytics`} color="violet" />
              <ActionTile icon={Package} label="Raw Materials" path={`${roleBase}/raw-materials`} color="amber" />
              {/* TEMP DISABLED - Future Admin Feature
              // Preserved for future implementation
              <ActionTile icon={ShieldCheck} label="Quality Control" path={`${roleBase}/quality`} color="rose" />
              */}
              <ActionTile icon={History} label="Production History" path={`${roleBase}/management`} color="slate" />
              <ActionTile icon={Users} label="Operator Sessions" path={`${roleBase}/users`} color="cyan" />
            </div>
          </section>

          {/* ─── 4. LIVE FACTORY SNAPSHOT ─── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Production Snapshot</h3>
              <button onClick={() => navigate(`${roleBase}/production`)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                Full Control View <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3 min-h-[100px] relative">
              {factoryQuery.isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center bg-slate-50/30 rounded-[2.5rem] border border-slate-100">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Polling Factory Stream...</p>
                </div>
              ) : factoryQuery.isError ? (
                <div className="py-20 flex flex-col items-center justify-center bg-rose-50/30 rounded-[2.5rem] border border-rose-100">
                  <AlertTriangle className="w-8 h-8 text-rose-500 mb-4" />
                  <p className="text-rose-600 text-[10px] font-black uppercase tracking-widest">Connectivity Error</p>
                  <button onClick={() => factoryQuery.refetch()} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20">Retry Sync</button>
                </div>
              ) : !factoryQuery.data?.activeBatches?.length ? (
                <div className="py-16 text-center bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic text-sm">Factory currently on standby.</p>
                </div>
              ) : (
                factoryQuery.data.activeBatches.map((batch: any, i: number) => (
                  <PipelineCard
                    key={batch.id}
                    batch={batch}
                    machines={machineQuery.data}
                    i={i}
                    machineError={machineQuery.isError}
                    isLoading={machineQuery.isLoading}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Alerts & Sync */}
        <div className="col-span-12 lg:col-span-4 space-y-8">

          {/* ─── 3. ALERTS PANEL ─── */}
          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 h-full flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Critical Alerts
              </h3>
              <button
                onClick={() => factoryQuery.refetch()}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  factoryQuery.isFetching ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                <RefreshCw className={cn("w-4 h-4", factoryQuery.isFetching && "animate-spin")} />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
              {factoryQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 animate-pulse">
                  <div className="w-full h-12 bg-slate-50 rounded-2xl mb-4" />
                  <div className="w-full h-12 bg-slate-50 rounded-2xl" />
                </div>
              ) : (alerts.length === 0 && !factoryQuery.isError) ? (
                <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest">
                    Operational Integrity Optimal
                  </p>
                </div>
              ) : factoryQuery.isError ? (
                <div className="text-center py-10">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Alert Sync Failed</p>
                </div>
              ) : null}

              {factoryQuery.data?.activeDowntimes?.map((stop: any) => (
                <AlertItem
                  key={stop.id}
                  type="DOWNTIME"
                  title={`Stop: ${stop.reason?.replace('_', ' ')}`}
                  sub={`${stop.line} • ${stop.station}`}
                />
              ))}

              {factoryQuery.data?.lowStockAlerts?.map((item: any) => (
                <AlertItem
                  key={item.id}
                  type="STOCK"
                  title={`Low Stock: ${item.itemName}`}
                  sub={`${item.quantity} ${item.unit} left`}
                />
              ))}
            </div>

            <div className="mt-10 pt-10 border-t border-slate-50">
              <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                  <Activity className="w-16 h-16" />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Shift Performance</p>
                <p className="text-sm font-bold leading-relaxed text-slate-300">
                  The morning shift has achieved <span className="text-emerald-400">104% of target</span>. No critical staff shortages reported.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

// ─── HELPER COMPONENTS ───

const CompactKPICard = ({ label, value, icon: Icon, color, sub, isAlert }: any) => {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-50 text-slate-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  const alertClasses = 'bg-rose-500 text-white';
  const normalClasses = colorMap[color] || 'bg-slate-50 text-slate-600';

  return (
    <div className={cn(
      "bg-white rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md",
      isAlert ? "border-rose-200 bg-rose-50/30" : "border-slate-100"
    )}>
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center",
          isAlert ? alertClasses : normalClasses
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <h4 className={cn("text-xl font-black tracking-tight", isAlert ? "text-rose-600" : "text-slate-900")}>
          {value}
        </h4>
        {sub && <span className="text-[8px] font-bold text-slate-400 uppercase">{sub}</span>}
      </div>
    </div>
  );
};

const ActionTile = ({ icon: Icon, label, path, color }: any) => {
  const navigate = useNavigate();
  
  // Tailwind static class mapping to avoid dynamic compilation issues
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    violet: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
    slate: 'bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:text-white',
    cyan: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
  }[color as string] || 'bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:text-white';

  return (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center gap-3 p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-lg transition-all group active:scale-95"
    >
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
        colorClasses
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center leading-tight">
        {label}
      </span>
    </button>
  );
};

const PipelineCard = ({ batch, machines, i, machineError, isLoading }: any) => {
  const navigate = useNavigate();
  const machine = machines?.find((m: any) => m.name === batch.line);
  const efficiency = machine?.efficiency || 0;
  const progress = batch.progress || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * i }}
      onClick={() => {
        const { user } = useAuthStore.getState();
        const roleBase = user?.role?.toLowerCase() === 'manager' ? '/manager' : '/admin';
        navigate(`${roleBase}/reports/batch/${batch.id}`);
      }}
      className="p-5 bg-white rounded-2xl border border-slate-100 flex items-center justify-between gap-6 group hover:shadow-xl hover:shadow-slate-200/40 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-5 min-w-[200px]">
        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-lg text-slate-400 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
          {batch.line?.split(' ')[1] || '1'}
        </div>
        <div>
          <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">{batch.batchCode}</p>
          <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{batch.product}</h4>
        </div>
      </div>

      <div className="flex-1 hidden sm:block max-w-[200px]">
        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-indigo-500 rounded-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OEE</p>
          <p className={cn(
            "text-sm font-black tracking-tighter",
            machineError ? "text-rose-400" : "text-emerald-600"
          )}>
            {isLoading ? '...' : (machineError ? 'ERR' : `${efficiency.toFixed(0)}%`)}
          </p>
        </div>
        <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase tracking-widest">
          {batch.status}
        </div>
      </div>
    </motion.div>
  );
};

const AlertItem = ({ type, title, sub }: any) => (
  <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-50 rounded-2xl hover:bg-white hover:border-slate-200 transition-all group cursor-pointer">
    <div className={cn(
      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
      type === 'DOWNTIME' ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
    )}>
      {type === 'DOWNTIME' ? <Activity className="w-4 h-4" /> : <Package className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase truncate">{title}</p>
      <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">{sub}</p>
    </div>
    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:translate-x-1 transition-transform" />
  </div>
);

export default ManagerDashboard;
