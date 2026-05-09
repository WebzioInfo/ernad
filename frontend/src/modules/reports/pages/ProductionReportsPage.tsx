import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { 
  FileText, Download, Filter, 
  Calendar, Layers, Tag, ChevronRight,
  AlertTriangle, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductionReportsPage() {
  const [dateRange, setDateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['production-report', dateRange],
    queryFn: async () => {
      const res = await api.get('/reports/production', {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    }
  });

  const exportPDF = () => {
    // Logic for PDF export will go here
    window.print();
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl">
              <FileText className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter">Production Ledger</h1>
              <p className="text-slate-400 font-bold mt-2">Comprehensive operational performance logs & OEE aggregates.</p>
            </div>
          </div>
          <button 
            onClick={exportPDF}
            className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-50 transition-all shadow-xl active:scale-95"
          >
            <Download className="w-5 h-5" />
            Export PDF Report
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
            <input 
              type="date" 
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
          <Calendar className="w-5 h-5 text-indigo-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
            <input 
              type="date" 
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
        <div className="h-10 w-px bg-slate-100 hidden md:block" />
        <button className="p-5 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-90">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Line</th>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU Details</th>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Output</th>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Wastage</th>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quality Yield</th>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-10 py-8">
                        <div className="h-12 bg-slate-100 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : reportData?.map((item: any, idx: number) => (
                  <motion.tr 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50/30 transition-all group"
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                          L{idx + 1}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 tracking-tight">{item.lineName}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Line</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">{item.brandName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-medium text-slate-500">{item.productName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <span className="text-xl font-black text-slate-900 tabular-nums tracking-tighter">
                        {Number(item.totalOutput).toLocaleString()}
                      </span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Units Produced</p>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <span className="text-xl font-black text-rose-600 tabular-nums tracking-tighter">
                        {Number(item.totalWastage).toLocaleString()}
                      </span>
                      <p className="text-[10px] font-black text-rose-400/60 uppercase tracking-widest mt-1">Rejected</p>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col items-center">
                        <div className={`
                          px-4 py-2 rounded-xl text-[11px] font-black tracking-widest flex items-center gap-2
                          ${item.rejectionRate < 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}
                        `}>
                          {item.rejectionRate < 2 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          {(100 - item.rejectionRate).toFixed(2)}%
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Compliance Score</p>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex justify-center">
                        <button className="p-4 hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 hover:shadow-lg transition-all text-slate-400 hover:text-indigo-600 active:scale-90">
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
