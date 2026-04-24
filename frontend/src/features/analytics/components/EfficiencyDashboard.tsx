import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Activity, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Zap 
} from 'lucide-react';

export default function EfficiencyDashboard({ filters }: { filters: any }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['line-performance', filters],
    queryFn: async () => {
      const res = await api.get('/analytics/line-performance', {
        params: {
          lineId: filters.lineId,
          brandId: filters.brandId !== 'all' ? filters.brandId : undefined,
          productId: filters.productId !== 'all' ? filters.productId : undefined,
        }
      });
      return res.data;
    },
    refetchInterval: 5000 
  });

  if (isLoading) return <div className="h-96 flex items-center justify-center text-slate-400">Synchronizing factory telemetry...</div>;

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard 
          label="Overall Efficiency (OEE)" 
          value={`${stats.oee}%`} 
          trend="+2.4%" 
          isPositive={true}
          icon={Activity}
          color="blue"
        />
        <MetricCard 
          label="Current Throughput" 
          value="104 BPM" 
          trend="-5%" 
          isPositive={false}
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard 
          label="Bottleneck Station" 
          value={stats.bottleneck} 
          icon={Zap}
          color="amber"
          isWarning={true}
        />
        <MetricCard 
          label="Quality Yield" 
          value="99.2%" 
          trend="+0.1%" 
          isPositive={true}
          icon={AlertCircle}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Output by Station */}
        <div className="col-span-7 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Station Throughput (BPM)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="station" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                   contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="throughput" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Trend */}
        <div className="col-span-5 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Efficiency Trend (24h)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { time: '06:00', val: 88 },
                { time: '08:00', val: 92 },
                { time: '10:00', val: 85 },
                { time: '12:00', val: 94 },
                { time: '14:00', val: 91 },
              ]}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
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
        <div className={`p-3 rounded-2xl ${
          color === 'blue' ? 'bg-blue-50 text-blue-600' : 
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
