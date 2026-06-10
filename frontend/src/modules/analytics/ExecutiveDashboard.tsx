import { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../../modules/auth/auth.store';
import {
  Activity, Database, AlertTriangle, RefreshCw, Package, Users, Truck, Factory, Server, FileText, Users2, LayoutList, CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import ManagerDashboard from './ManagerDashboard';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { useOutletContext, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Wifi } from 'lucide-react';

const DiagnosticWidget = () => {
  const { data } = useQuery({
    queryKey: ['diagnostics-summary'],
    queryFn: async () => {
      try {
        return (await api.get('/diagnostics/summary')).data;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 30000
  });

  if (!data) return null;

  return (
    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mt-8">
      <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
        <Wifi className="w-5 h-5 text-indigo-500" />
        Network Diagnostics
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-slate-50 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Connected</p>
          <p className="text-xl font-black text-emerald-600">{data?.connected || 0}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Failed</p>
          <p className="text-xl font-black text-rose-600">{data?.failed || 0}</p>
        </div>
      </div>
      {data?.mostCommonErrors?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">Common Errors</p>
          {data.mostCommonErrors.map((e: any, i: number) => (
            <div key={i} className="text-xs flex justify-between bg-rose-50 text-rose-700 p-2 rounded">
              <span className="truncate mr-2" title={e.error}>{e.error}</span>
              <span className="font-bold">{e.count}</span>
            </div>
          ))}
        </div>
      )}
      {data?.currentServiceWorker && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Latest Service Worker</p>
          <p className="text-xs font-mono text-slate-600 truncate" title={data.currentServiceWorker.activeScripts?.[0]}>{data.currentServiceWorker.activeScripts?.[0] || 'None'}</p>
        </div>
      )}
    </section>
  );
};

export default function ExecutiveDashboard() {
  const { user } = useAuthStore();
  const { filters, setFilters } = useOutletContext<{ filters: any, setFilters: (f: any) => void }>();
  const userRoles = (user?.roles || [user?.role]).map(r => String(r).toUpperCase());
  const isManager = userRoles.includes('MANAGER');

  const renderDashboard = () => {
    if (isManager) return <ManagerDashboard filters={filters} />;
    return <AdminDashboard filters={filters} />;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-center mb-8">
        <TimeRangeSelector
          value={filters.timeRange}
          onChange={(val) => setFilters({ timeRange: val })}
        />
      </div>
      {renderDashboard()}
    </div>
  );
}

// Compact Executive Card
const ExecCard = ({ title, value, subtitle, icon: Icon, colorClass }: any) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1">{title}</p>
      <h4 className="text-2xl font-black text-slate-900">{value}</h4>
      {subtitle && <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{subtitle}</p>}
    </div>
    <div className={`p-3 rounded-xl ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);

const AdminDashboard = memo(({ filters }: { filters: any }) => {
  const { data: factoryLive, refetch: refetchLive } = useQuery({
    queryKey: ['factory-live-overview', filters.timeRange],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE, { params: { timeRange: filters.timeRange } })).data,
    staleTime: 30000
  });

  const { data: todayKPI } = useQuery({
    queryKey: ['today-kpis-summary'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE, { params: { timeRange: 'today' } })).data,
    staleTime: 60000,
    enabled: filters.timeRange !== 'today'
  });

  const { data: weeklyKPI } = useQuery({
    queryKey: ['weekly-kpis-summary'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE, { params: { timeRange: 'week' } })).data,
    staleTime: 60000,
    enabled: filters.timeRange !== 'week'
  });

  const { data: efficiency } = useQuery({
    queryKey: ['machine-efficiency'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_EFFICIENCY)).data
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials-kpis'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.RAW_MATERIALS)).data,
  });

  const { data: productionStock } = useQuery({
    queryKey: ['production-stock-kpis'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.PRODUCTION_STOCK)).data,
  });

  const { startOfMonthStr, endOfMonthStr } = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return {
      startOfMonthStr: start.toISOString(),
      endOfMonthStr: end.toISOString()
    };
  }, []);

  const { data: monthlyKPI } = useQuery({
    queryKey: ['monthly-kpis-summary', startOfMonthStr, endOfMonthStr],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.KPIS, {
      params: { 
        startDate: startOfMonthStr, 
        endDate: endOfMonthStr 
      }
    })).data,
    staleTime: 60000
  });

  const displayStats = {
    packing: factoryLive?.counters?.packing || 0,
    dispatch: factoryLive?.counters?.dispatch || 0,
    yield: factoryLive?.counters?.blowing > 0 ? ((factoryLive?.counters?.packing / factoryLive?.counters?.blowing) * 100).toFixed(1) : '100'
  };

  const preformsStock = rawMaterials?.find((r: any) => r.name === 'Preforms')?.currentStock ?? 0;
  const capsStock = rawMaterials?.find((r: any) => r.name === 'Caps')?.currentStock ?? 0;
  const jarStock = productionStock?.find((p: any) => p.productName?.toLowerCase().includes('20l'))?.currentStock ?? 0;
  const monthlyProduced = monthlyKPI?.throughput ?? 0;
  const todayProduced = filters.timeRange === 'today' ? (factoryLive?.counters?.packing ?? 0) : (todayKPI?.counters?.packing ?? 0);
  const weeklyProduced = filters.timeRange === 'week' ? (factoryLive?.counters?.packing ?? 0) : (weeklyKPI?.counters?.packing ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Executive Summary
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            High-level overview of factory operations and inventory.
          </p>
        </div>
        <button 
           onClick={() => refetchLive()}
           className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-sm border border-slate-200 flex items-center gap-2 transition-all font-semibold text-sm"
         >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            Refresh Data
         </button>
      </header>

      {/* SECTION 1: Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ExecCard 
          title="Total Production" 
          value={displayStats.packing.toLocaleString()} 
          subtitle="Cases Produced"
          icon={Activity} 
          colorClass="bg-indigo-50 text-indigo-600" 
        />
        <ExecCard 
          title="Total Dispatch" 
          value={displayStats.dispatch.toLocaleString()} 
          subtitle="Cases Dispatched"
          icon={Truck} 
          colorClass="bg-blue-50 text-blue-600" 
        />
        <ExecCard 
          title="Today Produced Cases" 
          value={todayProduced.toLocaleString()} 
          subtitle="Finished Goods"
          icon={Package} 
          colorClass="bg-emerald-50 text-emerald-600" 
        />
        <ExecCard 
          title="Active Batches" 
          value={factoryLive?.activeBatches?.length || 0} 
          subtitle="Running currently"
          icon={Factory} 
          colorClass="bg-amber-50 text-amber-600" 
        />
        <ExecCard 
          title="Active Operators" 
          value={factoryLive?.summary?.activeOperatorsCount || 0} 
          subtitle="On Shift"
          icon={Users} 
          colorClass="bg-violet-50 text-violet-600" 
        />
        <ExecCard 
          title="Factory Yield" 
          value={`${displayStats.yield}%`} 
          subtitle="Global Efficiency"
          icon={CheckCircle2} 
          colorClass="bg-emerald-50 text-emerald-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        
        {/* Left Column: Overviews */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SECTION 2: Production Overview */}
          <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Production Overview
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Today</p>
                <p className="text-2xl font-black text-slate-900">{todayProduced.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">This Week</p>
                <p className="text-2xl font-black text-slate-900">{weeklyProduced.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">This Month</p>
                <p className="text-2xl font-black text-indigo-600">{monthlyProduced.toLocaleString()}</p>
              </div>
            </div>
            {/* Trend Chart */}
            <div className="mt-8 h-64 w-full">
              {factoryLive?.trend && factoryLive.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={factoryLive.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={(val) => {
                         try {
                           const date = parseISO(val);
                           if (filters.timeRange === 'live' || filters.timeRange === 'today') return format(date, 'HH:mm');
                           if (filters.timeRange === 'week') return format(date, 'EEE');
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
                      formatter={(value: any) => [`${value} Cases`, 'Produced']}
                      labelFormatter={(val) => {
                        try {
                          const date = parseISO(val);
                          if (filters.timeRange === 'live' || filters.timeRange === 'today') return format(date, 'MMM d, yyyy - HH:mm');
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

          {/* SECTION 3: Inventory Overview */}
          <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-500" />
              Inventory Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Finished Goods</p>
                <p className="text-xl font-black text-slate-900">{jarStock.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Raw Materials</p>
                <p className="text-xl font-black text-slate-900">{(preformsStock + capsStock).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Packaging</p>
                <p className="text-xl font-black text-slate-900">0</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Low Stock</p>
                <p className="text-xl font-black text-amber-700">{factoryLive?.lowStockAlerts?.length || 0}</p>
              </div>
            </div>
          </section>

          {/* SECTION 4: Factory Operations */}
          <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              Factory Operations
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-indigo-500">
                <p className="text-xs font-semibold text-slate-500 mb-1">Running Batches</p>
                <p className="text-xl font-black text-slate-900">{factoryLive?.activeBatches?.length || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-emerald-500">
                <p className="text-xs font-semibold text-slate-500 mb-1">Active Lines</p>
                <p className="text-xl font-black text-slate-900">{efficiency?.length || 0}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-amber-500">
                <p className="text-xs font-semibold text-slate-500 mb-1">Open Incidents</p>
                <p className="text-xl font-black text-slate-900">0</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-rose-500">
                <p className="text-xs font-semibold text-slate-500 mb-1">Maintenance Issues</p>
                <p className="text-xl font-black text-slate-900">{factoryLive?.activeDowntimes?.length || 0}</p>
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: Alerts & Actions */}
        <div className="space-y-8">
          
          {/* SECTION 5: Alerts Center */}
          <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Alerts & Exceptions
            </h3>
            <div className="space-y-4">
              {factoryLive?.lowStockAlerts?.length === 0 && factoryLive?.latestStops?.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400 text-center py-8">No active alerts.</p>
              ) : (
                <>
                  {factoryLive?.lowStockAlerts?.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.itemName}</p>
                        <p className="text-xs font-medium text-slate-600">Low stock: {item.quantity} {item.unit}</p>
                      </div>
                    </div>
                  ))}
                  {factoryLive?.latestStops?.map((stop: any) => (
                    <div key={stop.id} className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <Activity className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{stop.reason.replace('_', ' ')}</p>
                        <p className="text-xs font-medium text-slate-600">{stop.station} - {stop.duration}m</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* SECTION 6: Quick Actions */}
          <section className="bg-slate-900 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black text-white mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/live" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <Factory className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold text-white group-hover:text-indigo-300">Production Floor</span>
              </Link>
              <Link to="/admin/batches" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <LayoutList className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold text-white group-hover:text-blue-300">Batches</span>
              </Link>
              <Link to="/admin/logs" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold text-white group-hover:text-emerald-300">Production Logs</span>
              </Link>
              <Link to="/admin/inventory/raw-materials" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <Database className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-white group-hover:text-amber-300">Raw Materials</span>
              </Link>
              <Link to="/admin/inventory/products" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <Package className="w-5 h-5 text-rose-400" />
                <span className="text-xs font-bold text-white group-hover:text-rose-300">Products</span>
              </Link>
              <Link to="/admin/operators" className="flex flex-col gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors group">
                <Users2 className="w-5 h-5 text-violet-400" />
                <span className="text-xs font-bold text-white group-hover:text-violet-300">Operators</span>
              </Link>
            </div>
          </section>

          {/* SECTION 7: Diagnostics Widget */}
          <DiagnosticWidget />

        </div>
      </div>
    </motion.div>
  );
});
