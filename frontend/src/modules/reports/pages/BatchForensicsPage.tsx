import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import {
  X, Activity, Edit3,
  Check, AlertCircle, User, Clock,
  TrendingUp, Layers, Tag, MapPin, ChevronLeft, Loader2
} from 'lucide-react';
import { generateBatchAuditPDF } from '../../../utils/pdfExport';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const formatDecimal = (val: string | number | null | undefined) => {
  if (val === null || val === undefined) return '0';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num % 1 === 0 ? num.toLocaleString() : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function BatchForensicsPage() {
  const { id: batchId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ primaryCount: 0, wastageCount: 0, remarks: '' });
  const [isExporting, setIsExporting] = useState(false);

  // 1. Fetch Dossier (Metadata + Totals + Trend)
  const { data: dossier, isLoading: loadingDossier } = useQuery({
    queryKey: ['batch-dossier', batchId],
    queryFn: async () => (await api.get(`reports/batch/${batchId}`)).data,
    enabled: !!batchId
  });

  // 2. Fetch Detailed Logs for Editing (Categorized by Station)
  const [station, setStation] = useState('BLOWING');
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['batch-logs', batchId, station],
    queryFn: async () => (await api.get(`telemetry/history/${batchId}/${station}`)).data,
    enabled: !!batchId
  });

  // 3. Edit Mutation
  const editMutation = useMutation({
    mutationFn: async (logId: number) => {
      await api.patch(`telemetry/logs/${logId}`, editForm);
    },
    onSuccess: () => {
      toast.success('Log entry corrected successfully');
      setEditingLogId(null);
      queryClient.invalidateQueries({ queryKey: ['batch-logs', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier', batchId] });
    },
    onError: () => toast.error('Failed to update log entry')
  });

  const startEdit = (log: any) => {
    setEditingLogId(log.id);
    setEditForm({
      primaryCount: log.primaryCount,
      wastageCount: log.wastageCount,
      remarks: log.remarks || ''
    });
  };

  const downloadAuditPDF = async () => {
    if (!dossier) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 800));
    try {
      await generateBatchAuditPDF(dossier.metadata, dossier.totals, logs || [], station);
    } finally {
      setIsExporting(false);
    }
  };

  if (loadingDossier) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Loading Forensics...</p>
    </div>
  );

  const { metadata, totals, hourlyTrend } = dossier || {};

  return (
    <div className="space-y-10 pb-20">
      {/* Page Header */}
      <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate(-1)}
              className="w-16 h-16 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center justify-center hover:bg-white/10 transition-all group"
            >
              <ChevronLeft className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
            </button>
            <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">{metadata?.batch?.batchCode || 'Batch Dossier'}</h1>
                <span className={`
                  px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest
                  ${metadata?.batch?.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}
                `}>
                  {metadata?.batch?.status}
                </span>
              </div>
              <div className="flex items-center gap-6 mt-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <MapPin className="w-3.5 h-3.5" /> {metadata?.line?.name}
                </div>
                <div className="w-1 h-1 bg-slate-700 rounded-full" />
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5" /> {metadata?.batch?.startTime ? format(new Date(metadata.batch.startTime), 'MMM dd, HH:mm') : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={downloadAuditPDF}
              disabled={isExporting || loadingDossier || loadingLogs}
              className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isExporting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isExporting ? 'Generating...' : 'Download Audit PDF'}
            </button>
            <button className="px-8 py-4 bg-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20">Archive Batch</button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-10">
        {/* Statistics & Trend */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-10">
          <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden relative">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-indigo-500" />
                Production Velocity
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hourly Throughput</span>
              </div>
            </div>

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(time) => format(new Date(time), 'HH:mm')}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', color: '#fff' }}
                    itemStyle={{ color: '#818cf8' }}
                    formatter={(value: any) => [`${value} Output`, 'Produced']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1A9A91"
                    strokeWidth={4}
                    dot={{ fill: '#1A9A91', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Detailed Ledger */}
          <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
              <h3 className="text-xl font-black text-slate-900 tracking-tight italic">Forensic Event Ledger</h3>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                {['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStation(s)}
                    className={`
                      px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${station === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                    `}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-slate-50">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                    <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator Attribution</th>
                    <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Output</th>
                    <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Wastage</th>
                    <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingLogs ? (
                    <tr><td colSpan={5} className="p-20 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                  ) : logs?.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold italic uppercase tracking-widest text-[10px]">No telemetry records found for {station}</td></tr>
                  ) : logs?.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="text-xs font-black text-slate-900">{format(new Date(log.loggedAt), 'HH:mm:ss')}</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{format(new Date(log.loggedAt), 'dd MMM')}</p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <User className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 tracking-tight">{log.userName}</p>
                            {log.updatedByName && (
                              <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-0.5">
                                Revised by {log.updatedByName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {editingLogId === log.id ? (
                          <input
                            type="number"
                            className="w-24 px-3 py-2 bg-slate-100 border-none rounded-xl text-right font-black text-sm"
                            value={editForm.primaryCount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, primaryCount: Number(e.target.value) }))}
                          />
                        ) : (
                          <span className="text-sm font-black text-slate-900 tabular-nums">{log.primaryCount.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        {editingLogId === log.id ? (
                          <input
                            type="number"
                            className="w-24 px-3 py-2 bg-slate-100 border-none rounded-xl text-right font-black text-sm text-rose-600"
                            value={editForm.wastageCount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, wastageCount: Number(e.target.value) }))}
                          />
                        ) : (
                          <span className="text-sm font-black text-rose-600 tabular-nums">{formatDecimal(log.wastageCount)}</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          {editingLogId === log.id ? (
                            <>
                              <button
                                onClick={() => editMutation.mutate(log.id)}
                                disabled={editMutation.isPending}
                                className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => setEditingLogId(null)}
                                className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(log)}
                              className="w-10 h-10 bg-white border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:border-indigo-500 hover:text-indigo-600 hover:shadow-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Edit3 className="w-4.5 h-4.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-10">
          <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-lg font-black uppercase tracking-widest mb-10 italic flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Operational Totals
            </h3>

            <div className="space-y-8 relative z-10">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Produced Cases</p>
                  <p className="text-3xl font-black tabular-nums">{(totals?.casesTotal || 0).toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Scrap</p>
                  <p className="text-3xl font-black tabular-nums text-rose-400">{formatDecimal(totals?.scrapTotal)}</p>
                </div>
                <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-6">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-indigo-400">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black tracking-tight">{metadata?.brand?.name}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Brand Authority</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-amber-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black tracking-tight">{metadata?.product?.name}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Product SKU</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black tracking-tight">{metadata?.creator || 'System'}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Batch Initiated By</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Audit Compliance</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forensic Oversight Status</p>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
              This batch dossier is a locked industrial record. All manual adjustments to telemetry are tracked with operator attribution for regulatory forensic compliance.
            </p>
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex flex-col gap-4">
              <button className="w-full py-5 bg-slate-50 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">Verify Digital Signature</button>
              <button className="w-full py-5 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all">Report Integrity Issue</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
