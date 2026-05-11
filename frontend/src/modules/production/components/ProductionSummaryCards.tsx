import { motion } from 'framer-motion';
import { Target, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SummaryCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: any;
  color: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

function SummaryCard({ label, value, subValue, icon: Icon, color, trend }: SummaryCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden group">
      <div className={cn("absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity", color)}>
        <Icon className="w-12 h-12" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{label}</p>
        <div className="flex items-end gap-3">
          <h4 className="text-3xl font-black text-white tracking-tight">{value}</h4>
          {subValue && <span className="text-sm font-bold text-slate-500 mb-1">{subValue}</span>}
        </div>
        {trend && (
          <div className="flex items-center gap-2 mt-3">
            <div className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", 
              trend.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {trend.value}
            </div>
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">vs prev shift</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductionSummaryCards({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-4 gap-4 w-full">
      <SummaryCard
        label="Batch Target"
        value={stats.target || '---'}
        subValue="Units"
        icon={Target}
        color="text-indigo-500"
      />
      <SummaryCard
        label="Current Actual"
        value={stats.actual || 0}
        subValue="Units"
        icon={TrendingUp}
        color="text-emerald-500"
        trend={{ value: "+12%", isPositive: true }}
      />
      <SummaryCard
        label="Rejection Rate"
        value={stats.rejectionRate || '0.0'}
        subValue="%"
        icon={AlertCircle}
        color="text-rose-500"
        trend={{ value: "-2%", isPositive: true }}
      />
      <SummaryCard
        label="Est. Completion"
        value={stats.eta || '---'}
        icon={Clock}
        color="text-amber-500"
      />
    </div>
  );
}
