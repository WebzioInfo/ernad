import { Target, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { motion } from 'framer-motion';

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
  delay?: number;
}

function SummaryCard({ label, value, subValue, icon: Icon, color, trend, delay = 0 }: SummaryCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white border border-slate-200 rounded-[1.5rem] p-6 relative overflow-hidden group hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
    >
      {/* Decorative Accents */}
      <div className="absolute top-0 right-0 p-2 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700">
        <Icon className="w-24 h-24 text-slate-900" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("p-1.5 rounded-lg bg-slate-50 border border-slate-100", color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
        </div>

        <div className="flex items-baseline gap-2">
          <h4 className="text-4xl font-mono font-black text-slate-900 tracking-tighter tabular-nums">
            {value}
          </h4>
          {subValue && (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest translate-y-[-2px]">
              {subValue}
            </span>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
            <div className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded-md tracking-widest",
              trend.isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Shift Variance</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ProductionSummaryCards({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      <SummaryCard
        label="Batch Target"
        value={stats.target || '---'}
        subValue="pcs"
        icon={Target}
        color="text-indigo-600"
        delay={0.1}
      />
      <SummaryCard
        label="Production Net"
        value={stats.actual || 0}
        subValue="pcs"
        icon={TrendingUp}
        color="text-emerald-600"
        trend={{ value: "+12.4%", isPositive: true }}
        delay={0.2}
      />
      <SummaryCard
        label="Rejection Index"
        value={stats.rejectionRate || '0.0'}
        subValue="%"
        icon={AlertCircle}
        color="text-rose-600"
        trend={{ value: "-2.1%", isPositive: true }}
        delay={0.3}
      />
      <SummaryCard
        label="Est. Conclusion"
        value={stats.eta || '---'}
        icon={Clock}
        color="text-amber-600"
        delay={0.4}
      />
    </div>
  );
}
