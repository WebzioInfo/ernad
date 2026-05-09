import { memo } from 'react';
import { Calendar, Activity, Clock, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ranges = [
  { id: 'live', label: 'Live', icon: Activity, description: 'Real-time telemetry' },
  { id: 'today', label: 'Today', icon: Clock, description: 'Daily aggregates' },
  { id: 'week', label: 'This Week', icon: BarChart2, description: 'Weekly performance' },
  { id: 'month', label: 'This Month', icon: Calendar, description: 'Monthly reporting' },
];

export const TimeRangeSelector = memo(({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  return (
    <div className="flex p-1.5 bg-slate-100 rounded-[2rem] gap-1 relative shadow-inner overflow-x-auto no-scrollbar">
      {ranges.map((range) => {
        const isActive = value === range.id;
        const Icon = range.icon;
        
        return (
          <button
            key={range.id}
            onClick={() => onChange(range.id)}
            className={`
              relative flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-500 group whitespace-nowrap
              ${isActive ? 'text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="active-range"
                className="absolute inset-0 bg-white rounded-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon className={`w-4 h-4 relative z-10 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-125'}`} />
            <div className="relative z-10">
              <span className="block text-xs font-black uppercase tracking-widest leading-none">{range.label}</span>
              {isActive && (
                <motion.span 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter block mt-0.5"
                >
                  {range.description}
                </motion.span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});
