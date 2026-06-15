import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { motion } from 'framer-motion';
import { 
  X, User, Info, Activity, 
  Database, FileSpreadsheet, Loader2, AlertCircle, Percent
} from 'lucide-react';
import { format } from 'date-fns';

interface WastageBatchDrawerProps {
  batchId: string | null;
  onClose: () => void;
}

export default function WastageBatchDrawer({ batchId, onClose }: WastageBatchDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'logs' | 'transactions'>('overview');

  const { data: details, isLoading, error } = useQuery({
    queryKey: ['wastage-batch-details', batchId],
    queryFn: async () => {
      const res = await api.get(`/wastage-intelligence/batch/${batchId}`);
      return res.data;
    },
    enabled: !!batchId
  });

  if (!batchId) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[650px] bg-slate-900 text-white shadow-2xl z-50 flex flex-col border-l border-slate-800"
    >
      {/* Header */}
      <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center font-black">
            {details?.batchInfo?.batchCode?.slice(0, 2) || 'BT'}
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight">{details?.batchInfo?.batchCode || 'Loading Batch...'}</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              {details?.batchInfo?.skuName || 'SKU Account'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all hover:scale-105 active:scale-95 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Querying Forensic History...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <p className="text-lg font-black">Forensic Drilldown Failed</p>
          <p className="text-sm text-slate-400">Failed to load detailed analytics records for this batch.</p>
        </div>
      ) : (
        <>
          {/* Quick Metrics */}
          <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 border-b border-slate-800/60">
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/40">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Produced Cases</p>
              <h4 className="text-lg font-black mt-1 text-indigo-400">{details.batchInfo.producedCases}</h4>
            </div>
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/40">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Wastage (Units)</p>
              <h4 className="text-lg font-black mt-1 text-rose-400">{details.batchInfo.waste.toLocaleString()}</h4>
            </div>
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/40">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Quality Yield</p>
              <h4 className="text-lg font-black mt-1 text-emerald-400">{details.batchInfo.yield}%</h4>
            </div>
            <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/40">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Runtime (Mins)</p>
              <h4 className="text-lg font-black mt-1 text-amber-400">{details.batchInfo.runtimeMinutes}m</h4>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-8 pt-4 flex gap-2 border-b border-slate-800 bg-slate-900">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Info className="w-3.5 h-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'materials' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Database className="w-3.5 h-3.5" />
              Materials
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Telemetry Logs
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'transactions' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Transactions
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Batch Information Details */}
                <div className="bg-slate-950/30 p-6 rounded-3xl border border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-400" />
                    Accountability Context
                  </h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Production Line</p>
                      <p className="font-semibold mt-1 text-slate-200">{details.batchInfo.lineName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Supervising Operator</p>
                      <p className="font-semibold mt-1 text-slate-200">{details.batchInfo.operator}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Target Quantity</p>
                      <p className="font-semibold mt-1 text-slate-200">{details.batchInfo.targetQuantity ? `${details.batchInfo.targetQuantity} Cases` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Batch Status</p>
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase mt-1 ${details.batchInfo.status === 'CLOSED' ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {details.batchInfo.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stations Output Comparison */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Station Yield Analysis</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {details.stations.map((st: any) => (
                      <div key={st.station} className="bg-slate-950/20 p-5 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                        <div>
                          <p className="font-black text-sm text-slate-200 tracking-tight">{st.station}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                            Produced: {st.output.toLocaleString()} | Waste: {st.waste.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest flex items-center gap-1.5 ${st.yield >= 99 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            <Percent className="w-3 h-3 animate-pulse" />
                            {st.yield}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="pb-4">Material Name</th>
                      <th className="pb-4 text-right">Consumed</th>
                      <th className="pb-4 text-right">Wasted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm">
                    {details.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500 font-bold">No material usage transactions associated.</td>
                      </tr>
                    ) : (
                      // Aggregate transactions in-view to display consumption per item
                      Object.values(details.transactions.reduce((acc: any, curr: any) => {
                        if (!acc[curr.materialName]) {
                          acc[curr.materialName] = { name: curr.materialName, consumed: 0, unit: curr.unit, wasted: 0 };
                        }
                        acc[curr.materialName].consumed += curr.consumed;
                        return acc;
                      }, {})).map((item: any) => (
                        <tr key={item.name} className="hover:bg-slate-800/10">
                          <td className="py-4 font-bold text-slate-300">{item.name}</td>
                          <td className="py-4 text-right font-black tabular-nums">{item.consumed.toLocaleString()} <span className="text-[10px] text-slate-500 font-bold uppercase">{item.unit}</span></td>
                          <td className="py-4 text-right text-rose-400 font-black tabular-nums">-</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        <th className="pb-4">Time</th>
                        <th className="pb-4">Station</th>
                        <th className="pb-4 text-right">Output</th>
                        <th className="pb-4 text-right">Waste</th>
                        <th className="pb-4 pl-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {details.logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-bold">No telemetry logs found for this batch.</td>
                        </tr>
                      ) : (
                        details.logs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-800/10">
                            <td className="py-4 text-slate-400 font-medium">{format(new Date(log.loggedAt), 'hh:mm:ss a')}</td>
                            <td className="py-4 font-bold text-slate-300">{log.station}</td>
                            <td className="py-4 text-right font-black tabular-nums text-indigo-400">
                              {log.output.toLocaleString()} <span className="text-[9px] font-bold text-slate-600 uppercase">{log.unitType}</span>
                            </td>
                            <td className="py-4 text-right text-rose-400 font-black tabular-nums">{Number(log.wastageCount).toLocaleString()}</td>
                            <td className="py-4 pl-4 text-slate-400 max-w-[150px] truncate" title={log.remarks}>{log.remarks || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        <th className="pb-4">Time</th>
                        <th className="pb-4">Material</th>
                        <th className="pb-4 text-right">Quantity</th>
                        <th className="pb-4 pl-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {details.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 font-bold">No consumption ledger transactions found.</td>
                        </tr>
                      ) : (
                        details.transactions.map((tx: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/10">
                            <td className="py-4 text-slate-400 font-medium">{format(new Date(tx.loggedAt), 'MM/dd hh:mm a')}</td>
                            <td className="py-4 font-bold text-slate-300">{tx.materialName}</td>
                            <td className="py-4 text-right font-black tabular-nums text-emerald-400">
                              -{tx.consumed.toLocaleString()} <span className="text-[9px] font-bold text-slate-600 uppercase">{tx.unit}</span>
                            </td>
                            <td className="py-4 pl-4 text-slate-400 max-w-[200px] truncate" title={tx.remarks}>{tx.remarks}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
