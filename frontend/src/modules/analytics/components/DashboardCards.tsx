import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, ResponsiveContainer
} from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

const MOCK_CHART_DATA = [
  { name: '06:00', value: 400 },
  { name: '08:00', value: 300 },
  { name: '10:00', value: 600 },
  { name: '12:00', value: 800 },
  { name: '14:00', value: 500 },
  { name: '16:00', value: 900 },
  { name: '18:00', value: 1100 },
];

export const KPICard = memo(({ label, value, trend, icon: Icon, color, chartColor, negativeTrend, delay = 0 }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5 }}
      className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-xl group cursor-pointer relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent pointer-events-none" />
      <div className="flex justify-between items-start relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${color === 'emerald' ? 'bg-emerald-500 text-white shadow-emerald-200' :
          color === 'blue' ? 'bg-blue-500 text-white shadow-blue-200' :
            color === 'indigo' ? 'bg-indigo-500 text-white shadow-indigo-200' :
              'bg-amber-500 text-white shadow-amber-200'
          }`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${negativeTrend ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
          }`}>
          {negativeTrend ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div className="mt-8 relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</h4>
      </div>
      <div className="absolute bottom-0 left-0 right-0 w-full h-16 opacity-10 group-hover:opacity-25 transition-opacity" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={MOCK_CHART_DATA}>
            <Area type="monotone" dataKey="value" stroke="none" fill={chartColor} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});

export const StatusCard = memo(({ label, value, subLabel, icon: Icon, color, delay = 0 }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-xl relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50/50 opacity-50" />
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10 shadow-2xl transition-transform group-hover:rotate-12 ${color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
        color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
          color === 'blue' ? 'bg-blue-50 text-blue-600' :
            'bg-amber-50 text-amber-600'
        }`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{value}</h4>
        <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          {subLabel}
        </p>
      </div>
    </motion.div>
  );
});

export const HealthMetric = ({ label, status, score }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
    <div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-white">{status}</p>
    </div>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${score > 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
      }`}>
      {score}%
    </div>
  </div>
);

export { MOCK_CHART_DATA };
