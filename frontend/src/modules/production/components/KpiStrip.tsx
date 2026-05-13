import React from 'react';
import { Target, TrendingUp, AlertCircle, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: any;
  color: string;
}

const Metric: React.FC<MetricProps> = ({ label, value, subValue, icon: Icon, color }) => (
  <div className="flex flex-col gap-1 min-w-[130px] px-6 py-3.5 border-r border-gray-200/60 last:border-0 hover:bg-gray-50/50 transition-colors">
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={color} strokeWidth={2.5} />
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1.5 mt-0.5">
      <span className="text-[22px] font-semibold text-gray-900 tracking-tight tabular-nums leading-none">
        {value}
      </span>
      {subValue && (
        <span className="text-[11px] font-medium text-gray-400 uppercase leading-none">{subValue}</span>
      )}
    </div>
  </div>
);

interface KpiStripProps {
  actual: number | undefined | null;
  target: number | undefined | null;
  rejections: number | undefined | null;
  status: string;
}

export const KpiStrip: React.FC<KpiStripProps> = ({
  actual,
  target,
  rejections,
  status
}) => {
  const safeActual = actual || 0;
  const safeTarget = target || 0;
  const safeRejects = rejections || 0;

  let efficiency = 0;
  if (safeTarget > 0) {
    efficiency = (safeActual / safeTarget) * 100;
  }

  const isRunning = status === 'RUNNING';

  return (
    <div className="bg-white/50 backdrop-blur-md border-b border-gray-200/60 flex items-center overflow-x-auto no-scrollbar scroll-smooth pl-2">
      <Metric 
        label="Output" 
        value={safeActual.toLocaleString()} 
        icon={TrendingUp} 
        color="text-emerald-500" 
      />
      <Metric 
        label="Target" 
        value={safeTarget > 0 ? safeTarget.toLocaleString() : '--'} 
        icon={Target} 
        color="text-indigo-500" 
      />
      <Metric 
        label="Rejects" 
        value={safeRejects.toLocaleString()} 
        icon={AlertCircle} 
        color="text-rose-500" 
      />
      <Metric 
        label="Efficiency" 
        value={safeTarget > 0 ? `${efficiency.toFixed(1)}%` : '--'} 
        icon={Activity} 
        color="text-indigo-600" 
      />
      
      <div className="flex-1 min-w-[20px]" />
      
      {/* Live Indicator */}
      <div className="px-8 flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-1.5">
            Data Stream
          </span>
          <span className={cn(
            "text-[11px] font-semibold tracking-wide",
            isRunning ? "text-emerald-600" : "text-gray-500"
          )}>
            {isRunning ? "Live Sync Active" : "Standby"}
          </span>
        </div>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isRunning ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-300"
        )} />
      </div>
    </div>
  );
};
