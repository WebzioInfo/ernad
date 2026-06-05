import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import {
  X, Activity, Edit3,
  Check, AlertCircle, User, Clock,
  TrendingUp, Layers, Tag, MapPin, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
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

interface BatchDossierModalProps {
  batchId: string;
  onClose: () => void;
}

export function BatchDossierModal({ batchId, onClose }: BatchDossierModalProps) {
  const queryClient = useQueryClient();
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    primaryCount: number;
    wastageCount: number;
    remarks: string;
    shrinkWastageKg?: number;
    selectedShrinks?: Array<{ shrinkId: string; shrinkName: string; mmUsed: number }>;
    glueUsageKg?: number;
    rollsUsed?: number;
  }>({ primaryCount: 0, wastageCount: 0, remarks: '' });

  // 1. Fetch Dossier (Metadata + Totals + Trend)
  const { data: dossier, isLoading: loadingDossier } = useQuery({
    queryKey: ['batch-dossier', batchId],
    queryFn: async () => (await api.get(`reports/batch/${batchId}`)).data
  });

  // 2. Fetch Detailed Logs for Editing (Categorized by Station)
  const [station, setStation] = useState('BLOWING');
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['batch-logs', batchId, station],
    queryFn: async () => (await api.get(`telemetry/history/${batchId}/${station}`)).data
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials-packing'],
    queryFn: async () => (await api.get('master-data/raw-materials?station=PACKING')).data,
  });
  const packingRawMaterials = rawMaterials || [];

  const toggleDossierShrink = (material: any) => {
    setEditForm(prev => {
      const currentShrinks = prev.selectedShrinks || [];
      const exists = currentShrinks.find((s: any) => s.shrinkId === material.id);
      let newShrinks;
      if (exists) {
        newShrinks = currentShrinks.filter((s: any) => s.shrinkId !== material.id);
      } else {
        newShrinks = [...currentShrinks, { shrinkId: material.id, shrinkName: material.name, mmUsed: 0, wastageKg: 0 }];
      }
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  const handleDossierMmUsedChange = (shrinkId: string, value: number) => {
    setEditForm(prev => {
      const currentShrinks = prev.selectedShrinks || [];
      const newShrinks = currentShrinks.map((s: any) =>
        s.shrinkId === shrinkId ? { ...s, mmUsed: value } : s
      );
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  const handleDossierWastageKgChange = (shrinkId: string, value: number) => {
    setEditForm(prev => {
      const currentShrinks = prev.selectedShrinks || [];
      const newShrinks = currentShrinks.map((s: any) =>
        s.shrinkId === shrinkId ? { ...s, wastageKg: value } : s
      );
      return { ...prev, selectedShrinks: newShrinks };
    });
  };

  // 3. Edit Mutation
  const editMutation = useMutation({
    mutationFn: async (logId: number) => {
      if (!editForm.remarks) {
        throw new Error('Reason is required for correction.');
      }
      let totalWastage = Number(editForm.wastageCount || 0);
      if (station === 'PACKING') {
        totalWastage = (editForm.selectedShrinks || []).reduce((sum: number, s: any) => sum + (s.wastageKg || 0), 0);
      }
      const payload: any = {
        primaryCount: editForm.primaryCount,
        wastageCount: totalWastage,
        remarks: editForm.remarks
      };
      if (station === 'PACKING') {
        payload.shrinkWastageKg = totalWastage;
        payload.selectedShrinks = editForm.selectedShrinks || [];
      }
      if (station === 'LABELING') {
        payload.glueUsedKg = Number(editForm.glueUsageKg || 0);
        payload.rollsUsed = Number(editForm.rollsUsed || 0);
      }
      await api.post(`production/logs/${logId}/correct`, { newData: payload, reason: editForm.remarks });
    },
    onSuccess: () => {
      toast.success('Log entry corrected successfully');
      setEditingLogId(null);
      queryClient.invalidateQueries({ queryKey: ['batch-logs', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier', batchId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to update log entry');
    }
  });

  const startEdit = (log: any) => {
    setEditingLogId(log.id);
    setEditForm({
      primaryCount: log.primaryCount,
      wastageCount: log.station === 'PACKING' ? Number(log.shrinkWastageKg || 0) : log.wastageCount,
      remarks: log.remarks || '',
      shrinkWastageKg: log.shrinkWastageKg !== undefined ? Number(log.shrinkWastageKg) : 0,
      selectedShrinks: log.selectedShrinks ? JSON.parse(JSON.stringify(log.selectedShrinks)) : [],
      glueUsageKg: log.glueUsageKg !== undefined ? Number(log.glueUsageKg) : 0,
      rollsUsed: log.rollsUsed !== undefined ? Number(log.rollsUsed) : 0
    });
  };

  if (loadingDossier) return null;

  const { metadata, totals, hourlyTrend } = dossier || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-7xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{metadata?.batch?.batchCode}</h2>
                <span className={`
                  px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest
                  ${metadata?.batch?.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}
                `}>
                  {metadata?.batch?.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <MapPin className="w-3 h-3" /> {metadata?.line?.name}
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Clock className="w-3 h-3" /> {metadata?.batch?.startTime ? format(new Date(metadata.batch.startTime), 'MMM dd, HH:mm') : 'N/A'}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 hover:bg-rose-50 hover:text-rose-500 transition-all text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Top Cards & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                  Production Velocity
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hourly Throughput</span>
                </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
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
                      formatter={(value: number) => [`${value} Output`, 'Produced']}
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
            </div>

            <div className="space-y-6">
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Product Identity</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-indigo-600">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{metadata?.brand?.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Brand</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-amber-600">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{metadata?.product?.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU Variant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-emerald-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{metadata?.creator || 'System'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Logged By</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Produced</p>
                  <p className="text-2xl font-black text-indigo-700 tracking-tighter">{(totals?.packingTotal || 0).toLocaleString()}</p>
                </div>
                <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100">
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Waste</p>
                  <p className="text-2xl font-black text-rose-700 tracking-tighter">{formatDecimal(totals?.scrapTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Industrial Event Ledger</h3>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                {['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStation(s)}
                    className={`
                      px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                      ${station === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                    `}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Primary Count</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Wastage</th>
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Edit Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingLogs ? (
                    <tr><td colSpan={6} className="p-20 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                  ) : logs?.length === 0 ? (
                    <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold italic">No logs found for this station.</td></tr>
                  ) : logs?.map((log: any) => {
                    const isEditing = editingLogId === log.id;
                    const isPacking = log.station === 'PACKING';
                    return (
                      <Fragment key={log.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <span className="text-xs font-bold text-slate-500">{format(new Date(log.loggedAt), 'HH:mm:ss')}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{log.userName}</p>
                                {log.updatedByName && (
                                  <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">
                                    Edited by {log.updatedByName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`
                                 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest
                                 ${log.eventType === 'NORMAL_PRODUCTION' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}
                               `}>
                              {log.eventType}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right font-black tabular-nums text-slate-900">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-24 px-3 py-1.5 bg-slate-100 border-none rounded-lg text-right font-black"
                                value={editForm.primaryCount}
                                onChange={(e) => setEditForm(prev => ({ ...prev, primaryCount: Number(e.target.value) }))}
                              />
                            ) : log.primaryCount.toLocaleString()}
                          </td>
                          <td className="px-8 py-5 text-right font-black tabular-nums text-rose-600">
                            {isEditing ? (
                              isPacking ? (
                                <span className="text-xs text-slate-400">See panel below</span>
                              ) : (
                                <input
                                  type="number"
                                  className="w-24 px-3 py-1.5 bg-slate-100 border-none rounded-lg text-right font-black text-rose-600"
                                  value={editForm.wastageCount}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, wastageCount: Number(e.target.value) }))}
                                />
                              )
                            ) : (
                              isPacking ? (
                                `${formatDecimal(log.shrinkWastageKg !== undefined ? log.shrinkWastageKg : log.wastageCount)} KG`
                              ) : (
                                `${formatDecimal(log.wastageCount)} ${log.station === 'LABELING' ? 'KG' : ''}`
                              )
                            )}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex justify-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => editMutation.mutate(log.id)}
                                    disabled={editMutation.isPending || !editForm.remarks}
                                    className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {editMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingLogId(null)}
                                    className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-all"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => startEdit(log)}
                                  className="w-10 h-10 bg-white border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:border-indigo-500 hover:text-indigo-600 hover:shadow-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isEditing && isPacking && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-8 py-4 border-b border-slate-100">
                              <div className="space-y-4 max-w-2xl text-left">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                    Select Shrink Materials
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {packingRawMaterials.filter((m: any) => m.materialType === 'SHRINK').map((material: any) => {
                                      const isSelected = (editForm.selectedShrinks || []).some((s: any) => s.shrinkId === material.id);
                                      return (
                                        <button
                                          key={material.id}
                                          type="button"
                                          onClick={() => toggleDossierShrink(material)}
                                          className={`w-28 px-3 py-2 rounded-lg border text-left flex items-center justify-between transition-all duration-200 relative overflow-hidden h-11 cursor-pointer ${
                                            isSelected
                                              ? 'bg-indigo-50 border-indigo-500'
                                              : 'bg-white border-slate-200 hover:border-indigo-500/45'
                                          }`}
                                        >
                                          <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                            {material.name.match(/(\d+)\s*(?:mm|m)/i)
                                              ? `${material.name.match(/(\d+)\s*(?:mm|m)/i)![1]}mm`
                                              : material.name}
                                          </span>
                                          {isSelected && (
                                            <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                              ✓
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                 {(editForm.selectedShrinks || []).length > 0 && (
                                   <div className="space-y-2 p-3 border border-indigo-150 rounded-xl bg-indigo-50/20">
                                     <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                       Usage and Wastage per Selected Shrink
                                     </h5>
                                     <div className="grid grid-cols-1 gap-2">
                                       {(editForm.selectedShrinks || []).map((shrink: any) => (
                                         <div key={shrink.shrinkId} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col gap-2">
                                           <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">{shrink.shrinkName}</span>
                                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                             <div className="space-y-1">
                                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block text-left">Usage</label>
                                               <div className="flex items-center gap-1">
                                                 <input
                                                   type="number"
                                                   step="0.1"
                                                   value={shrink.mmUsed}
                                                   onChange={(e) => handleDossierMmUsedChange(shrink.shrinkId, Number(e.target.value))}
                                                   className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 text-right"
                                                 />
                                                 <span className="text-[9px] font-bold text-slate-400">KG</span>
                                               </div>
                                             </div>
                                             <div className="space-y-1">
                                               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block text-left">Wastage</label>
                                               <div className="flex items-center gap-1">
                                                 <input
                                                   type="number"
                                                   step="0.1"
                                                   value={shrink.wastageKg || 0}
                                                   onChange={(e) => handleDossierWastageKgChange(shrink.shrinkId, Number(e.target.value))}
                                                   className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-indigo-500/50 text-right"
                                                 />
                                                 <span className="text-[9px] font-bold text-slate-400">KG</span>
                                               </div>
                                             </div>
                                           </div>
                                         </div>
                                       ))}
                                     </div>
                                   </div>
                                 )}

                                 <div className="space-y-1">
                                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-left">Correction Reason (Required)</label>
                                   <input
                                     type="text"
                                     value={editForm.remarks}
                                     onChange={(e) => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                                     placeholder="Explain correction reason..."
                                     className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500/50"
                                   />
                                 </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {isEditing && !isPacking && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-8 py-4 border-b border-slate-100">
                              <div className="flex flex-col sm:flex-row gap-4 w-full">
                                {log.station === 'LABELING' && (!dossier?.batch?.line?.name ? true : !dossier.batch.line.name.toLowerCase().includes('2')) && (
                                  <div className="flex-1 space-y-1 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Glue Used (KG)</label>
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={editForm.glueUsageKg || 0}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, glueUsageKg: Number(e.target.value) }))}
                                      className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500/50"
                                    />
                                  </div>
                                )}
                                {log.station === 'LABELING' && (!dossier?.batch?.line?.name ? true : dossier.batch.line.name.toLowerCase().includes('2')) && (
                                  <div className="flex-1 space-y-1 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Rolls Used</label>
                                    <input
                                      type="number"
                                      step="1"
                                      value={editForm.rollsUsed || 0}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, rollsUsed: Number(e.target.value) }))}
                                      className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500/50"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 space-y-1 text-left">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Correction Reason (Required)</label>
                                  <input
                                    type="text"
                                    required
                                    value={editForm.remarks}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="Explain the correction reason..."
                                    className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500/50"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-400">
            <AlertCircle className="w-5 h-5" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Management Override Active: All modifications are logged and audited.</p>
          </div>
          <div className="flex gap-4">
            <button className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/50 transition-all">Download CSV</button>
            <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200">Archive Batch</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
