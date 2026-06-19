import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History, User, Clock, AlertTriangle, CheckCircle2,
  Search, ArrowLeft, Download, Shield,
  Database, Zap, ClipboardList, Edit3, Trash2,
  Activity, Users, Package, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { api } from '@/services/api-client';
import useAuthStore from '../auth/auth.store';

const formatDecimal = (val: string | number | null | undefined) => {
  if (val === null || val === undefined) return '0';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num % 1 === 0 ? num.toLocaleString() : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function BatchForensicsDashboard() {
  const { user } = useAuthStore();
  const { batchId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'timeline' | 'telemetry' | 'accountability' | 'downtime' | 'inventory' | 'sales' | 'audit' | 'insights'>('timeline');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionPrimary, setCorrectionPrimary] = useState(0);
  const [correctionWastage, setCorrectionWastage] = useState(0);

  const { data: forensics, isLoading, error } = useQuery({
    queryKey: ['batch-forensics', batchId],
    queryFn: async () => (await api.get(`forensics/batch/${batchId}`)).data,
    retry: false,
  });

  const correctMutation = useMutation({
    mutationFn: async (payload: any) => (await api.patch(`forensics/log/${selectedEntry.id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forensics', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['batch-logs'] });
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
      setSelectedEntry(null);
      setCorrectionReason('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => (await api.delete(`forensics/log/${selectedEntry.id}`, { data: { reason } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forensics', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossier'] });
      queryClient.invalidateQueries({ queryKey: ['batch-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['batch-logs'] });
      queryClient.invalidateQueries({ queryKey: ['production-logs-all'] });
      queryClient.invalidateQueries({ queryKey: ['production-batches-all'] });
      setSelectedEntry(null);
      setCorrectionReason('');
    }
  });

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Zap className="w-12 h-12 text-indigo-500 animate-pulse" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Generating Forensic DNA...</p>
      </div>
    </div>
  );

  // Hard 500 / network error — batch not found at all
  if (error && !forensics) return (
    <div className="p-12 text-center">
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-3xl inline-block">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-slate-900 mb-2">Record Not Found</h2>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          The requested batch could not be located in the industrial database.
        </p>
        <button onClick={() => navigate(-1)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Records
        </button>
      </div>
    </div>
  );

  // Batch-not-found returned by backend
  if (forensics?.error) return (
    <div className="p-12 text-center">
      <div className="bg-amber-50 border border-amber-100 p-8 rounded-3xl inline-block">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-slate-900 mb-2">Batch Not Found</h2>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{forensics.error}</p>
        <button onClick={() => navigate(-1)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Records
        </button>
      </div>
    </div>
  );

  // Safe destructuring — every section defaults to [] / {} to prevent crashes
  const {
    batch,
    timeline = [],
    auditTrail = [],
    materialUsage = [],
    telemetry = [],
    accountability = [],
    salesMapping = [],
    inventoryVariance = []
  } = forensics ?? {};

  return (
    <div className="space-y-8">
      {/* Forensic Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Investigative Audit</h1>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${batch.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                batch.status === 'RUNNING' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 animate-pulse' :
                  'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                {batch.status}
              </div>
            </div>
            <p className="text-slate-400 font-bold flex items-center gap-2 uppercase tracking-widest text-[10px]">
              <Database className="w-3 h-3" /> Batch: <span className="text-slate-900">{batch.batchCode}</span>
              <span className="text-slate-200 mx-2">|</span>
              <Shield className="w-3 h-3" /> Forensic Identity: <span className="text-slate-900">{batch.id.slice(0, 8)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export DNA Report
          </button>
          <button className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Verify Compliance
          </button>
        </div>
      </div>

      {/* Stats DNA Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Start Time', value: format(new Date(batch.startTime), 'MMM dd, HH:mm'), icon: Clock, color: 'indigo' },
          { label: 'Attributed Operator', value: timeline[0]?.operator || 'N/A', icon: User, color: 'amber' },
          { label: 'Total Events', value: timeline.length, icon: History, color: 'emerald' },
          { label: 'Audit Flags', value: auditTrail.length, icon: Shield, color: 'rose' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-${stat.color}-50 rounded-2xl text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-lg font-black text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Forensic Tabs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">
        <div className="border-b border-slate-100 px-8 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-8">
            {[
              { id: 'timeline', label: 'Production Ledger', icon: History },
              { id: 'telemetry', label: 'Telemetry', icon: Activity },
              { id: 'accountability', label: 'Accountability', icon: Users },
              { id: 'downtime', label: 'Downtime Log', icon: AlertTriangle },
              { id: 'inventory', label: 'Material DNA', icon: Database },
              { id: 'sales', label: 'Sales Traceability', icon: Package },
              { id: 'insights', label: 'Anomaly & Variance', icon: Layers },
              { id: 'audit', label: 'Change History', icon: Shield },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-6 border-b-2 transition-all font-bold text-sm relative ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events..."
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Production Event Sequence</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live from Industrial Ledger</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                  {timeline.map((entry: any) => (
                    <div key={entry.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${entry.isDeleted ? 'bg-rose-50/30' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${entry.isDeleted ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                          {entry.isDeleted ? <Trash2 className="w-4 h-4" /> : < Zap className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 uppercase">{entry.station} Entry</span>
                            {entry.isDeleted && (
                              <span className="px-2 py-0.5 bg-rose-600 text-white text-[8px] font-black rounded uppercase tracking-tighter">DELETED</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {entry.operator}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(entry.loggedAt), 'HH:mm:ss')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Output</p>
                          <p className="font-black text-slate-900">{entry.primaryCount} <span className="text-[10px] text-slate-400 font-bold">UNITS</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Wastage</p>
                          <p className={`font-black ${Number(entry.wastageCount) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {formatDecimal(entry.wastageCount)} <span className="text-[10px] text-slate-400 font-bold">UNITS</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Used</p>
                          <p className="font-black text-indigo-600">
                            {formatDecimal(Number(entry.primaryCount) + Number(entry.wastageCount))} <span className="text-[10px] text-indigo-400 font-bold">UNITS</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          <button
                            className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200"
                            title="Forensic Diff Viewer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {user?.role === 'Admin' && (
                            <button
                              onClick={() => {
                                setSelectedEntry(entry);
                                setCorrectionPrimary(entry.primaryCount);
                                setCorrectionWastage(entry.wastageCount);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-amber-600 transition-all border border-transparent hover:border-slate-200"
                              title="Correct Record"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Correction Modal */}
                <AnimatePresence>
                  {selectedEntry && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedEntry(null)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg relative z-10 shadow-2xl overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                          <Shield className="w-40 h-40" />
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2">Forensic Correction</h2>
                        <p className="text-slate-500 text-sm font-bold mb-8 uppercase tracking-widest">Record #{selectedEntry.id}</p>

                        <div className="space-y-6 relative z-10">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Count</label>
                              <input
                                type="number"
                                value={correctionPrimary}
                                onChange={(e) => setCorrectionPrimary(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Wastage Count</label>
                              <input
                                type="number"
                                value={correctionWastage}
                                onChange={(e) => setCorrectionWastage(Number(e.target.value))}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Reason for Audit</label>
                            <textarea
                              value={correctionReason}
                              onChange={(e) => setCorrectionReason(e.target.value)}
                              placeholder="e.g. Operator typo in case count, verified via manual tally."
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none min-h-[100px]"
                            />
                          </div>

                          <div className="flex items-center gap-3 pt-4">
                            <button
                              onClick={() => setSelectedEntry(null)}
                              className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(correctionReason)}
                              className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all"
                              title="Forensic Record Removal"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => correctMutation.mutate({ primaryCount: correctionPrimary, wastageCount: correctionWastage, reason: correctionReason })}
                              disabled={!correctionReason || correctMutation.isPending}
                              className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs disabled:opacity-50"
                            >
                              {correctMutation.isPending ? 'Logging...' : 'Apply Correction'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800">
                  <Shield className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-bold">
                    This audit trail is immutable. Every modification requires a formal reason and creates a forensic snapshot.
                  </p>
                </div>

                <div className="space-y-4">
                  {auditTrail.map((audit: any) => (
                    <div key={audit.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative overflow-hidden group hover:border-indigo-200 transition-all">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Shield className="w-12 h-12" />
                      </div>

                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 font-black text-xs shadow-sm">
                            {audit.actor?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{audit.action.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {audit.actor} • {audit.role || 'System'} • {format(new Date(audit.occurredAt), 'MMM dd, HH:mm:ss')}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                          {audit.category}
                        </div>
                      </div>

                      {audit.payload?.reason && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200/50 mb-4">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Formal Reason for Correction</p>
                          <p className="text-sm font-bold text-slate-700">"{audit.payload.reason}"</p>
                        </div>
                      )}

                      {audit.payload?.diff && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                            <p className="text-[8px] font-black text-rose-400 uppercase mb-1">Before</p>
                            <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                              {JSON.stringify(audit.payload.diff.before, null, 2)}
                            </pre>
                          </div>
                          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                            <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">After</p>
                            <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                              {JSON.stringify(audit.payload.diff.after, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {auditTrail.length === 0 && (
                    <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-50" />
                      <h4 className="text-slate-900 font-black uppercase tracking-widest text-xs">No Forensic Corrections Found</h4>
                      <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-widest">This batch maintains 100% original integrity</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'telemetry' && (
              <motion.div key="telemetry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                    <Activity className="w-6 h-6 text-indigo-400" />
                    Throughput Velocity (Hourly)
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={telemetry}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1A9A91" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#1A9A91" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          tickFormatter={(t) => format(new Date(t), 'HH:mm')}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#1e293b', color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#1A9A91" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                        <Area type="monotone" dataKey="wastage" stroke="#f43f5e" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'accountability' && (
              <motion.div key="accountability" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {accountability.map((acc: any, i: number) => (
                  <div key={i} className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900">{acc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{acc.username}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> Last Active: {format(new Date(acc.lastActive), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900">{acc.totalEntries}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logs Recorded</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'downtime' && (
              <motion.div key="downtime" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {forensics.downtimes.map((dt: any) => (
                  <div key={dt.id} className="p-6 bg-rose-50/30 border border-rose-100 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{dt.reason} at {dt.station}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {format(new Date(dt.startTime), 'HH:mm')} - {dt.endTime ? format(new Date(dt.endTime), 'HH:mm') : 'ACTIVE'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-rose-600">{dt.durationMinutes || 0}m</p>
                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Duration</p>
                    </div>
                  </div>
                ))}
                {forensics.downtimes.length === 0 && (
                  <div className="p-12 text-center text-emerald-500 font-bold uppercase tracking-widest text-xs bg-emerald-50/50 rounded-[2rem] border border-dashed border-emerald-100">
                    Maximum Availability: 0m Downtime Recorded.
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'sales' && (
              <motion.div key="sales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {salesMapping?.map((s: any, i: number) => (
                  <div key={i} className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center">
                        <Package className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900">{s.orderNumber}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.customer || 'Direct Dispatch'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <div className="text-center">
                        <p className="text-xl font-black text-slate-900">{s.quantity}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reserved Qty</p>
                      </div>
                      <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
                {(!salesMapping || salesMapping.length === 0) && (
                  <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs bg-slate-50 rounded-[2rem] border border-dashed">
                    Batch units not yet attributed to specific sales orders.
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'insights' && (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {inventoryVariance?.map((v: any, i: number) => (
                    <div key={i} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-sm font-black text-slate-900">{v.item}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{v.unit}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${Math.abs(v.variancePct) > 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                          {v.variancePct > 0 ? '+' : ''}{v.variancePct}% Variance
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Theoretical</p>
                          <p className="text-lg font-black text-slate-900">{v.theoretical.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Actual</p>
                          <p className="text-lg font-black text-slate-900">{v.actual.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                          <span>Efficiency Alignment</span>
                          <span className={v.variance > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                            {v.variance > 0 ? 'Wastage Detected' : 'Optimal Usage'}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v.variance > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (v.actual / v.theoretical) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!inventoryVariance || inventoryVariance.length === 0) && (
                    <div className="col-span-2 p-20 text-center bg-slate-50 rounded-[3rem] border border-dashed">
                      <Layers className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold italic uppercase tracking-widest text-xs">BOM configuration missing or no usage recorded.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'inventory' && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {materialUsage.map((material: any, idx: number) => (
                    <div key={material.id ?? idx} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {material.stockId ? `Stock: ${String(material.stockId).slice(0, 8)}…` : 'Material Movement'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {new Date(material.occurredAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {material.type}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{material.quantityChange}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UNITS</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-4 italic">
                        Balance after: {material.balanceAfter} — {material.remarks || 'Production deduction'}
                      </p>
                    </div>
                  ))}
                </div>
                {materialUsage.length === 0 && (
                  <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs bg-slate-50 rounded-[2rem] border border-dashed">
                    No material movements attributed to this batch.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
