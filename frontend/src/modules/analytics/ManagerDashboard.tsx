import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Database,
  Gauge,
  History,
  LayoutDashboard,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import useAuthStore from '../auth/auth.store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

type TimeRange = 'live' | 'today' | 'week' | 'month';

type DashboardOverview = {
  timeRange: TimeRange;
  kpis: {
    activeLines: number;
    runningBatches: number;
    machineOee: number;
    unitsPacked: number;
    systemAlerts: number;
    staffActive: number;
    downtimeMinutes: number;
  };
  materials: {
    preformsAvailable: number;
    capsAvailable: number;
    jar20LStock: number;
    producedDuringPeriod: number;
    preformsUsedDuringPeriod: number;
    capsUsedDuringPeriod: number;
    preformPiecesUsedDuringPeriod: number;
    capPiecesUsedDuringPeriod: number;
    shrinkUsedDuringPeriod: number;
    labelsUsedDuringPeriod: number;
  };
  activeProduction: Array<{
    id: string;
    batchCode: string;
    line: string;
    shift: string;
    product: string;
    currentOutput: number;
    status: string;
    runtimeMinutes: number;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    severity: string;
    target: string;
  }>;
  activity: {
    dispatchQuantity: number;
    damageQuantity: number;
    returnQuantity: number;
  };
  trend: Array<{
    time: string;
    produced: number;
  }>;
};

const number = (value: number) => new Intl.NumberFormat('en-IN').format(Math.round(Number(value || 0)));

const ManagerDashboard = memo(({ filters }: { filters?: { timeRange?: TimeRange } }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const roleBase = user?.role?.toLowerCase() === 'manager' ? '/manager' : '/admin';
  const timeRange = filters?.timeRange || 'today';

  const overviewQuery = useQuery({
    queryKey: ['dashboard-overview', timeRange],
    queryFn: async () => (await api.get<DashboardOverview>(ENDPOINTS.DASHBOARD.OVERVIEW, { params: { timeRange } })).data,
    refetchInterval: timeRange === 'live' ? 30000 : false,
    staleTime: timeRange === 'live' ? 10000 : 60000,
    retry: 1,
  });

  const data = overviewQuery.data;
  const loadingValue = overviewQuery.isLoading ? '...' : undefined;
  const nav = {
    production: `${roleBase}/production`,
    batches: `${roleBase}/management`,
    logs: `${roleBase}/production-logs`,
    operators: `${roleBase}/operators`,
    rawMaterials: `${roleBase}/raw-materials`,
    incidents: `${roleBase}/incidents`,
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <CompactKPICard label="Active Lines" value={loadingValue ?? number(data?.kpis.activeLines || 0)} icon={Activity} color="indigo" />
        <CompactKPICard label="Running Batches" value={loadingValue ?? number(data?.kpis.runningBatches || 0)} icon={LayoutDashboard} color="blue" />
        <CompactKPICard label="Machine OEE" value={loadingValue ?? `${data?.kpis.machineOee || 0}%`} icon={Gauge} color="emerald" />
        <CompactKPICard label="Units Packed" value={loadingValue ?? number(data?.kpis.unitsPacked || 0)} icon={Package} color="slate" />
        <CompactKPICard label="System Alerts" value={loadingValue ?? number(data?.kpis.systemAlerts || 0)} icon={AlertTriangle} color="rose" isAlert={(data?.kpis.systemAlerts || 0) > 0 || overviewQuery.isError} />
        <CompactKPICard label="Staff Active" value={loadingValue ?? number(data?.kpis.staffActive || 0)} icon={Users} color="cyan" />
        <CompactKPICard label="Downtime" value={loadingValue ?? `${number(data?.kpis.downtimeMinutes || 0)}m`} icon={Clock} color="amber" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Strategic Interventions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <ActionTile icon={LayoutDashboard} label="Production Floor" path={nav.production} color="indigo" />
              <ActionTile icon={Play} label="Start New Batch" path={nav.batches} color="emerald" />
              <ActionTile icon={History} label="Production History" path={nav.logs} color="slate" />
              <ActionTile icon={Users} label="Operator Sessions" path={nav.operators} color="cyan" />
              <ActionTile icon={Database} label="Raw Materials" path={nav.rawMaterials} color="amber" />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Production Trend</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-72">
              {data?.trend && data.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={(val) => {
                         try {
                           const date = parseISO(val);
                           if (timeRange === 'live' || timeRange === 'today') return format(date, 'HH:mm');
                           if (timeRange === 'week') return format(date, 'EEE');
                           return format(date, 'MMM d');
                         } catch (e) {
                           return val;
                         }
                      }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value} Cases`, 'Produced']}
                      labelFormatter={(val) => {
                        try {
                          const date = parseISO(val);
                          if (timeRange === 'live' || timeRange === 'today') return format(date, 'MMM d, yyyy - HH:mm');
                          return format(date, 'MMM d, yyyy');
                        } catch (e) {
                          return val;
                        }
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="produced" 
                      stroke="#6366f1" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full bg-slate-50 rounded-xl border border-slate-100 border-dashed flex items-center justify-center">
                  <p className="text-sm font-semibold text-slate-400">No production trend data</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Live Material & Stock</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <CompactKPICard label="20L Jar Stock" value={loadingValue ?? number(data?.materials.jar20LStock || 0)} icon={Package} color="emerald" />
              <CompactKPICard label="Produced During Period" value={loadingValue ?? number(data?.materials.producedDuringPeriod || 0)} icon={Activity} color="amber" />
              <CompactKPICard label="Preforms Used" value={loadingValue ?? number(data?.materials.preformsUsedDuringPeriod || data?.materials.preformPiecesUsedDuringPeriod || 0)} icon={Database} color="slate" />
              <CompactKPICard label="Caps Used" value={loadingValue ?? number(data?.materials.capsUsedDuringPeriod || data?.materials.capPiecesUsedDuringPeriod || 0)} icon={Package} color="cyan" />
              <CompactKPICard label="Shrink Used" value={loadingValue ?? `${number(data?.materials.shrinkUsedDuringPeriod || 0)} kg`} icon={Package} color="indigo" />
              <CompactKPICard label="Labels Used" value={loadingValue ?? number(data?.materials.labelsUsedDuringPeriod || 0)} icon={Database} color="blue" />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Production Snapshot</h3>
              <button onClick={() => navigate(nav.production)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                Live Production <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 gap-3 px-5 py-3 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <span>Line</span>
                <span>Shift</span>
                <span>Batch</span>
                <span className="col-span-2">Product</span>
                <span>Output</span>
                <span>Status</span>
              </div>
              {overviewQuery.isLoading ? (
                <div className="py-14 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Loading production records...</div>
              ) : overviewQuery.isError ? (
                <div className="py-14 text-center">
                  <AlertTriangle className="w-7 h-7 text-rose-500 mx-auto mb-3" />
                  <button onClick={() => overviewQuery.refetch()} className="text-[10px] font-black uppercase tracking-widest text-rose-600">Retry dashboard sync</button>
                </div>
              ) : !data?.activeProduction.length ? (
                <div className="py-14 text-center text-sm font-bold text-slate-400">No running batches for this selection.</div>
              ) : (
                data.activeProduction.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => navigate(`${roleBase}/reports/batch/${batch.id}`)}
                    className="grid grid-cols-7 gap-3 w-full px-5 py-4 border-t border-slate-100 text-left hover:bg-indigo-50/40 transition-colors"
                  >
                    <span className="text-xs font-black text-slate-800 truncate">{batch.line}</span>
                    <span className="text-xs font-bold text-slate-500 truncate">{batch.shift}</span>
                    <span className="text-xs font-black text-indigo-600 truncate">{batch.batchCode}</span>
                    <span className="col-span-2 text-xs font-bold text-slate-700 truncate">{batch.product}</span>
                    <span className="text-xs font-black text-slate-900">{number(batch.currentOutput)}</span>
                    <span>
                      <span className="inline-flex px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                        {batch.status} / {number(batch.runtimeMinutes)}m
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 min-h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                Critical Alerts
              </h3>
              <button
                onClick={() => overviewQuery.refetch()}
                className={cn('p-2 rounded-xl transition-all', overviewQuery.isFetching ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}
              >
                <RefreshCw className={cn('w-4 h-4', overviewQuery.isFetching && 'animate-spin')} />
              </button>
            </div>

            <div className="space-y-3 flex-1">
              {overviewQuery.isLoading ? (
                <div className="h-40 rounded-xl bg-slate-50 animate-pulse" />
              ) : overviewQuery.isError ? (
                <div className="py-14 text-center text-[10px] font-black uppercase tracking-widest text-rose-500">Dashboard endpoint failed</div>
              ) : !data?.alerts.length ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No critical alerts</p>
                </div>
              ) : (
                data.alerts.map((alert) => (
                  <AlertItem
                    key={`${alert.type}-${alert.id}`}
                    alert={alert}
                    onClick={() => navigate(resolveAlertPath(roleBase, alert.target))}
                  />
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-3 gap-2">
              <MiniStat label="Dispatch" value={number(data?.activity.dispatchQuantity || 0)} />
              <MiniStat label="Damage" value={number(data?.activity.damageQuantity || 0)} />
              <MiniStat label="Returns" value={number(data?.activity.returnQuantity || 0)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

const resolveAlertPath = (roleBase: string, target: string) => {
  if (target === 'raw-materials') return `${roleBase}/raw-materials`;
  if (target === 'incidents') return `${roleBase}/incidents`;
  if (target === 'reports') return `${roleBase}/production-logs`;
  return `${roleBase}/production`;
};

const CompactKPICard = ({ label, value, icon: Icon, color, isAlert }: any) => {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-50 text-slate-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className={cn('bg-white rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md min-w-0', isAlert ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100')}>
      <div className="flex items-center gap-3 mb-2 min-w-0">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', isAlert ? 'bg-rose-500 text-white' : colorMap[color] || colorMap.slate)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      </div>
      <h4 className={cn('text-xl font-black tracking-tight truncate', isAlert ? 'text-rose-600' : 'text-slate-900')}>{value}</h4>
    </div>
  );
};

const ActionTile = ({ icon: Icon, label, path, color }: any) => {
  const navigate = useNavigate();
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    slate: 'bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:text-white',
    cyan: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
  }[color as string] || 'bg-slate-50 text-slate-600 group-hover:bg-slate-600 group-hover:text-white';

  return (
    <button onClick={() => navigate(path)} className="flex flex-col items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-lg transition-all group active:scale-95">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm', colorClasses)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center leading-tight">{label}</span>
    </button>
  );
};

const AlertItem = ({ alert, onClick }: { alert: DashboardOverview['alerts'][number]; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-4 p-4 w-full bg-slate-50 border border-slate-50 rounded-2xl hover:bg-white hover:border-slate-200 transition-all group text-left">
    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white', alert.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500')}>
      {alert.type === 'MACHINE_DOWNTIME' ? <Wrench className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase truncate">{alert.title}</p>
      <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate">{alert.detail}</p>
    </div>
    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:translate-x-1 transition-transform" />
  </button>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2 min-w-0">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 truncate">{label}</p>
    <p className="text-sm font-black text-slate-900 truncate">{value}</p>
  </div>
);

export default ManagerDashboard;
