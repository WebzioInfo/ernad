import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { 
  Zap, Package, CheckCircle2, AlertTriangle
} from 'lucide-react';

const MOCK_SUMMARY = {
  stats: [
    { station: 'BLOWING', total: 12450 },
    { station: 'FILLING', total: 12420 },
    { station: 'LABELING', total: 12380 },
    { station: 'PACKING', total: 1032 }, // Cases
  ],
  oee: 84.5,
  quality: 99.2,
  availability: 92.1,
  performance: 91.8
};

export default function ProductionOverviewDashboard() {
  const { filters } = useOutletContext<{ filters: any }>();
  const { data: realSummary, isLoading } = useQuery({
    queryKey: ['factory-summary', filters],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/line-performance', {
          params: {
            lineId: filters.lineId,
            brandId: filters.brandId !== 'all' ? filters.brandId : undefined,
            productId: filters.productId !== 'all' ? filters.productId : undefined,
          }
        });
        return res.data;
      } catch (e) {
        return null;
      }
    },
    refetchInterval: 10000
  });

  const summary = realSummary || MOCK_SUMMARY;
  const isMock = !realSummary;

  if (isLoading) return <div className="animate-pulse space-y-4">
    <div className="h-32 bg-slate-100 rounded-3xl" />
    <div className="h-64 bg-slate-100 rounded-3xl" />
  </div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {isMock && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900 tracking-tight uppercase">Simulation Mode Active</p>
            <p className="text-xs font-medium text-amber-700">Factory telemetry is currently offline. Viewing high-fidelity operational simulation.</p>
          </div>
        </div>
      )}

      {/* Real-time Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Daily Output" 
          value={summary?.stats?.find((s:any) => s.station === 'PACKING')?.total || 0} 
          subLabel="Cases Packed" 
          icon={Package} 
          color="blue" 
        />
        <SummaryCard 
          label="Line Efficiency" 
          value={`${summary?.oee}%`} 
          subLabel="Current OEE" 
          icon={Zap} 
          color="emerald" 
        />
        <SummaryCard 
          label="Quality Yield" 
          value={`${summary?.quality}%`} 
          subLabel="Good vs Total" 
          icon={CheckCircle2} 
          color="indigo" 
        />
        <SummaryCard 
          label="Recent Alerts" 
          value="2" 
          subLabel="In last hour" 
          icon={AlertTriangle} 
          color="amber" 
          warning
        />
      </div>

      {/* Station Status Grid */}
      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Station Health & Throughput</h3>
            <p className="text-sm font-bold text-slate-400 mt-1">Real-time telemetry from all active nodes</p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {summary?.stats?.map((station: any) => (
            <StationCard 
              key={station.station}
              name={station.station}
              total={station.total}
              status="ONLINE"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subLabel, icon: Icon, color, warning }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
        color === 'blue' ? 'bg-blue-50 text-blue-600' :
        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
        color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
        'bg-amber-50 text-amber-600'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className={`text-3xl font-black tracking-tighter ${warning ? 'text-amber-600' : 'text-slate-900'}`}>{value}</h4>
      <p className="text-xs font-bold text-slate-400 mt-1">{subLabel}</p>
    </div>
  );
}

function StationCard({ name, total }: any) {
  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <h5 className="text-sm font-black text-slate-900 tracking-tight">{name}</h5>
        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900">{total.toLocaleString()}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Units</span>
      </div>
      <div className="mt-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 w-[70%] group-hover:w-[75%] transition-all duration-1000" />
      </div>
    </div>
  );
}
