import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  History, User, Clock, AlertTriangle, CheckCircle2, 
  Search, Filter, ArrowLeft, Download, Shield,
  Database, Zap, Beaker, ClipboardList, Edit3, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../app/api/api-client';
import { format } from 'date-fns';

export default function BatchForensicsDashboard() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'timeline' | 'audit' | 'inventory' | 'qc'>('timeline');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionPrimary, setCorrectionPrimary] = useState(0);
  const [correctionWastage, setCorrectionWastage] = useState(0);

  const { data: forensics, isLoading, error } = useQuery({
    queryKey: ['batch-forensics', batchId],
    queryFn: async () => (await api.get(`/forensics/batch/${batchId}`)).data,
  });

  const correctMutation = useMutation({
    mutationFn: async (payload: any) => (await api.patch(`/forensics/log/${selectedEntry.id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forensics', batchId] });
      setSelectedEntry(null);
      setCorrectionReason('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => (await api.delete(`/forensics/log/${selectedEntry.id}`, { data: { reason } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-forensics', batchId] });
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

  if (error || forensics?.error) return (
    <div className="p-12 text-center">
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-3xl inline-block">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-black text-slate-900 mb-2">Investigation Aborted</h2>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          {forensics?.error || "The requested industrial record could not be reconstructed for forensic analysis."}
        </p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Records
        </button>
      </div>
    </div>
  );

  const { batch, timeline, auditTrail, materialUsage, qcRecords } = forensics;

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
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                batch.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
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
              { id: 'audit', label: 'Change History', icon: Shield },
              { id: 'inventory', label: 'Material DNA', icon: Database },
              { id: 'qc', label: 'Quality Parameters', icon: Beaker }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-6 border-b-2 transition-all font-bold text-sm relative ${
                  activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
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
                  {timeline.map((entry: any, i: number) => (
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
                          <p className={`font-black ${entry.wastageCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {entry.wastageCount} <span className="text-[10px] text-slate-400 font-bold">UNITS</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          <button 
                            className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200"
                            title="Forensic Diff Viewer"
                          >
                            <History className="w-4 h-4" />
                          </button>
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

            {/* Other tabs stubs for now */}
            {activeTab === 'inventory' && (
              <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                Material Reconciliation View Coming Soon
              </div>
            )}
            {activeTab === 'qc' && (
              <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                Quality DNA Profile Coming Soon
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
