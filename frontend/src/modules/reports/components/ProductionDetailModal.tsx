import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  X, Clock, Download, FileText,
  Printer, Activity, Target, Factory, Hexagon, Package, BarChart
} from 'lucide-react';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';

interface ProductionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportParams: {
    startDate: string;
    endDate: string;
    lineId: string;
    productId: string;
    lineName: string;
    productName: string;
    brandName: string;
  } | null;
}

export function ProductionDetailModal({ isOpen, onClose, reportParams }: ProductionDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['production-details', reportParams],
    queryFn: async () => {
      if (!reportParams) return null;
      const res = await api.get(ENDPOINTS.REPORTS.PRODUCTION + '/details', {
        params: {
          startDate: reportParams.startDate,
          endDate: reportParams.endDate,
          lineId: reportParams.lineId,
          productId: reportParams.productId
        }
      });
      return res.data;
    },
    enabled: !!reportParams && isOpen
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handlePdf = () => {
    if (!data || !reportParams) return;
    import('../utils/productionDossierPdf').then(({ generateProductionDossierPdf }) => {
      generateProductionDossierPdf(data, reportParams);
    });
  };

  const formatNum = (num: number) => Number(num || 0).toLocaleString();
  const formatDec = (num: number) => Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="relative w-full max-w-[90vw] h-[90vh] bg-slate-50 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-white px-10 py-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Factory className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                  Production Dossier
                </h2>
                <div className="flex items-center gap-4 mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Hexagon className="w-3.5 h-3.5" /> Batch: {data?.batches?.length > 1 ? 'Multiple Batches' : (data?.batches?.[0] || 'N/A')}</span>
                  <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> {reportParams?.lineName}</span>
                  <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {reportParams?.productName}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {reportParams && format(new Date(reportParams.startDate), 'dd-MMM-yyyy')} to {reportParams && format(new Date(reportParams.endDate), 'dd-MMM-yyyy')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handlePdf} className="h-12 px-6 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button onClick={handlePrint} className="h-12 px-6 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <div className="w-px h-8 bg-slate-200 mx-2" />
              <button
                onClick={onClose}
                className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Compiling forensic data...</p>
              </div>
            ) : (
              <>
                {/* SECTION 1: PRODUCTION SUMMARY */}
                <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-500" /> Executive Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {[
                      { label: 'Produced Cases', val: formatNum(data?.summary?.producedCases), color: 'text-slate-900' },
                      { label: 'Produced Units', val: formatNum(data?.summary?.producedUnits), color: 'text-indigo-600' },
                      { label: 'Rejected Units', val: formatDec(data?.summary?.rejectedUnits), color: 'text-rose-500' },
                      { label: 'Quality Yield', val: `${formatDec(data?.summary?.qualityYield)}%`, color: 'text-emerald-500' },
                      { label: 'Dispatch Qty', val: formatNum(data?.summary?.dispatchQty), color: 'text-amber-500' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={`text-3xl font-black tabular-nums tracking-tighter ${stat.color}`}>{stat.val}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION 6: LINE BREAKDOWN (Current context is always 1 Line based on aggregation) */}
                <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" /> Line Breakdown
                  </h3>
                  <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex items-center justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/5" />
                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center font-black text-2xl tracking-tighter">
                        {reportParams?.lineName.replace('LINE ', 'L')}
                      </div>
                      <div>
                        <p className="text-xl font-black">{reportParams?.lineName}</p>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Scope</p>
                      </div>
                    </div>
                    <div className="relative z-10 flex gap-12 text-right">
                      <div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Cases</p>
                        <p className="text-2xl font-black tabular-nums">{formatNum(data?.summary?.producedCases)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Waste</p>
                        <p className="text-2xl font-black tabular-nums text-rose-400">{formatDec(data?.summary?.rejectedUnits)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Yield</p>
                        <p className="text-2xl font-black tabular-nums text-emerald-400">{formatDec(data?.summary?.qualityYield)}%</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* --- ROW 1: STATION ANALYSIS --- */}
                <div className="grid grid-cols-1 gap-10">
                  <section>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <BarChart className="w-4 h-4 text-blue-500" /> Station Analysis
                    </h3>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Station</th>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Output</th>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Waste</th>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Yield %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {data?.stationAnalysis?.map((stat: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-indigo-500">{stat.station}</td>
                              <td className="px-6 py-4 text-right font-black tabular-nums text-slate-900">{formatNum(stat.output)}</td>
                              <td className="px-6 py-4 text-right font-black tabular-nums text-rose-500">{formatDec(stat.waste)}</td>
                              <td className="px-6 py-4 text-right">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-black ${stat.yieldPct >= 98 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {formatDec(stat.yieldPct)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>



                {/* --- ROW 3: CONSUMPTION & TELEMETRY LOGS --- */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                  <section className="xl:col-span-1">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" /> Material Consumption
                    </h3>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Material</th>
                            <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Consumed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {data?.materialConsumption?.map((mat: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-700">{mat.materialName}</td>
                              <td className="px-6 py-4 text-right font-black tabular-nums text-indigo-600">{formatDec(mat.consumed)} <span className="text-[10px] text-slate-400">{mat.unit}</span></td>
                            </tr>
                          ))}
                          {(!data?.materialConsumption || data.materialConsumption.length === 0) && (
                            <tr>
                              <td colSpan={2} className="px-6 py-10 text-center text-sm font-bold text-slate-400">No transactions found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="xl:col-span-2">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" /> Telemetry Logs
                    </h3>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-sm relative">
                          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md bg-slate-50/90">
                            <tr>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Time</th>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Batch</th>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Station</th>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Output</th>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Unit Type</th>
                              <th className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Waste</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {data?.logs?.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-600">
                                  {format(new Date(log.loggedAt), 'hh:mm a')}<br/>
                                  <span className="text-[10px] font-medium text-slate-400">{format(new Date(log.loggedAt), 'dd-MMM')}</span>
                                </td>
                                <td className="px-6 py-4 font-black text-xs tracking-tight text-indigo-600">{log.batchCode || 'N/A'}</td>
                                <td className="px-6 py-4 font-black text-[9px] uppercase tracking-widest text-slate-500">{log.station}</td>
                                <td className="px-6 py-4 text-right font-black tabular-nums">{formatNum(log.output !== undefined ? log.output : log.primaryCount)}</td>
                                <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">{log.unitType || 'Units'}</td>
                                <td className="px-6 py-4 text-right font-black tabular-nums text-rose-500">{formatDec(log.wastageCount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
