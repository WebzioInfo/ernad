import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';
import {
  FileText, Download, Filter,
  Calendar, Layers, Tag, ChevronRight,
  AlertTriangle, CheckCircle2, History,
  Clock, MapPin, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { generateProductionPDF } from '../../../utils/pdfExport';

export default function ProductionReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'summaries' | 'batches'>('summaries');
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: reportData, isLoading: loadingSummaries } = useQuery({
    queryKey: ['production-report', dateRange],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.REPORTS.PRODUCTION, {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    },
    enabled: activeTab === 'summaries'
  });

  const { data: batchesData, isLoading: loadingBatches } = useQuery({
    queryKey: ['production-batches', dateRange],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.REPORTS.BATCHES, {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    },
    enabled: activeTab === 'batches'
  });

  const exportPDF = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      await generateProductionPDF(dateRange, reportData || [], batchesData || []);
    } finally {
      setIsExporting(false);
    }
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
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">Operational Ledger</h1>
              <p className="text-slate-400 font-bold mt-2">Comprehensive production logs, shift OEE & batch dossiers.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setActiveTab('summaries')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'summaries' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Summaries
              </button>
              <button
                onClick={() => setActiveTab('batches')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'batches' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Batches
              </button>
            </div>
          </div>
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
        <button
          onClick={exportPDF}
          disabled={isExporting}
          className="h-[60px] px-8 bg-white text-slate-900 border border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? 'Generating...' : 'Export PDF'}
        </button>
        <button className="h-[60px] w-[60px] bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-90 flex items-center justify-center">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        {activeTab === 'summaries' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Line</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU Details</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Output</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Wastage</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Processed</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quality Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {loadingSummaries ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-10 py-8">
                          <div className="h-12 bg-slate-100 rounded-2xl w-full" />
                        </td>
                      </tr>
                    ))
                  ) : reportData?.map((item: any, idx: number) => (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hover:bg-slate-50/30 transition-all"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">L{idx + 1}</div>
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
                        <span className="text-xl font-black text-slate-900 tabular-nums tracking-tighter">{Number(item.totalOutput).toLocaleString()}</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Units Produced</p>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <span className="text-xl font-black text-rose-600 tabular-nums tracking-tighter">{Number(item.totalWastage).toLocaleString()}</span>
                        <p className="text-[10px] font-black text-rose-400/60 uppercase tracking-widest mt-1">Rejected</p>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <span className="text-xl font-black text-indigo-600 tabular-nums tracking-tighter">{(Number(item.totalOutput) + Number(item.totalWastage)).toLocaleString()}</span>
                        <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest mt-1">Total Used</p>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col items-center">
                          <div className={`px-4 py-2 rounded-xl text-[11px] font-black tracking-widest flex items-center gap-2 ${item.rejectionRate < 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {item.rejectionRate < 2 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {(100 - item.rejectionRate).toFixed(2)}%
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Compliance Score</p>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID / Code</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manufacturing Line</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Accountability</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Output (Units)</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingBatches ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-10 py-8"><div className="h-12 bg-slate-100 rounded-2xl w-full" /></td>
                    </tr>
                  ))
                ) : batchesData?.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-slate-50/30 transition-all group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                          <History className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 tracking-tight">{batch.batchCode}</p>
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{batch.brandName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{batch.lineName}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {format(new Date(batch.startTime), 'MMM dd, HH:mm')}
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-5">Production Start</p>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <span className="text-lg font-black text-slate-900 tabular-nums">{(batch.packingTotal || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex justify-center">
                        <span className={`
                           px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest
                           ${batch.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}
                         `}>
                          {batch.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex justify-center">
                        <button
                          onClick={() => navigate(`/manager/reports/batch/${batch.id}`)}
                          className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white hover:shadow-xl hover:shadow-indigo-200 transition-all active:scale-90"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
