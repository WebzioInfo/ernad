import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Activity, AlertCircle,
  ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';

export default function EfficiencyDashboardPage() {
  const { filters } = useOutletContext<{ filters: any }>();
  const isLive = filters.timeRange === 'live';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['line-performance', filters],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.ANALYTICS.LINE_PERFORMANCE, {
        params: {
          lineId: filters.lineId,
          brandId: filters.brandId !== 'all' ? filters.brandId : undefined,
          productId: filters.productId !== 'all' ? filters.productId : undefined,
        }
      });
      return res.data;
    },
    enabled: !!filters.lineId && filters.lineId !== 'all' && isLive,
    refetchInterval: 5000
  });

  const getDates = () => {
    const end = new Date();
    const start = new Date();
    if (filters.timeRange === 'today') start.setHours(0, 0, 0, 0);
    else if (filters.timeRange === 'week') start.setDate(start.getDate() - 7);
    else if (filters.timeRange === 'month') start.setDate(start.getDate() - 30);
    return { start, end };
  };

  const { start, end } = getDates();

  const { data: historicalKPIs } = useQuery({
    queryKey: ['line-kpis', filters],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.ANALYTICS.KPIS, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          lineId: filters.lineId
        }
      });
      return res.data;
    },
    enabled: !!filters.lineId && filters.lineId !== 'all' && !isLive
  });

  const { data: historicalTrend } = useQuery({
    queryKey: ['line-historical-trend', filters],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.ANALYTICS.HISTORICAL, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          lineId: filters.lineId,
          interval: filters.timeRange === 'today' ? 'hour' : 'day'
        }
      });
      return res.data.map((d: any) => ({
        time: filters.timeRange === 'today' ? new Date(d.time).getHours() + ':00' : new Date(d.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        val: Number(d.totalProduction)
      }));
    },
    enabled: !!filters.lineId && filters.lineId !== 'all' && !isLive
  });

  if (isLoading) return <div className="h-96 flex items-center justify-center text-slate-400">Synchronizing factory telemetry...</div>;

  if (!stats && isLive) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[3rem] border border-dashed border-slate-200 gap-4">
        <Activity className="w-12 h-12 text-slate-200 animate-pulse" />
        <div className="text-center">
          <p className="font-black text-slate-900 tracking-tight text-lg">No Active Production</p>
          <p className="text-sm font-medium text-slate-400">Please start a batch on this line to see real-time metrics.</p>
        </div>
      </div>
    );
  }

  const displayKPIs = isLive ? {
    oee: stats?.oee || 0,
    throughput: "104 BPM",
    bottleneck: stats?.bottleneck || 'N/A',
    quality: "99.2%"
  } : {
    oee: historicalKPIs?.oee || 0,
    throughput: historicalKPIs?.throughput || 0,
    bottleneck: 'Aggregated',
    quality: `${historicalKPIs?.quality || 0}%`
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard
          label="Overall Efficiency (OEE)"
          value={`${displayKPIs.oee}%`}
          trend={isLive ? "+2.4%" : "Avg"}
          isPositive={true}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          label={isLive ? "Current Throughput" : "Total Throughput"}
          value={isLive ? displayKPIs.throughput : (Number(displayKPIs.throughput) / 1000).toFixed(1) + 'k'}
          trend={isLive ? "-5%" : "Total"}
          isPositive={isLive ? false : true}
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard
          label="Operational Status"
          value={displayKPIs.bottleneck}
          icon={Zap}
          color="amber"
          isWarning={isLive}
        />
        <MetricCard
          label="Quality Yield"
          value={displayKPIs.quality}
          trend={isLive ? "+0.1%" : "Avg"}
          isPositive={true}
          icon={AlertCircle}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Output by Station */}
        <div className="col-span-7 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">
            {isLive ? 'Station Throughput (BPM)' : 'Daily Production Vol.'}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={isLive ? (stats?.stats || []) : historicalTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey={isLive ? "station" : "time"}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey={isLive ? "throughput" : "val"} fill="#1A9A91" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Trend */}
        <div className="col-span-5 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">
            {isLive ? 'Efficiency Trend (24h)' : `Throughput Trend (${filters.timeRange})`}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={isLive ? [
                { time: '06:00', val: 88 },
                { time: '08:00', val: 92 },
                { time: '10:00', val: 85 },
                { time: '12:00', val: 94 },
                { time: '14:00', val: 91 },
              ] : historicalTrend}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A9A91" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#1A9A91" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="val" stroke="#1A9A91" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, trend, isPositive, icon: Icon, color, isWarning }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color === 'blue' ? 'bg-blue-50 text-blue-600' :
            color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
              color === 'amber' ? 'bg-amber-50 text-amber-600' :
                'bg-indigo-50 text-indigo-600'
          }`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className={`text-2xl font-black tracking-tight ${isWarning ? 'text-amber-600' : 'text-slate-900'}`}>{value}</h4>
    </div>
  );
}
