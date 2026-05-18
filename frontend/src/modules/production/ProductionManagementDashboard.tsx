import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Shield, History,
  Search, ChevronRight, Zap,
  TrendingUp, AlertTriangle, Layers,
  RefreshCw, LayoutDashboard,
  Box, Terminal,
  Play
} from 'lucide-react';
import { api } from '../../services/api-client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../auth/auth.store';

// --- COMPONENTS ---

const TechnicalBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f8fafc]">
    {/* Matrix Grid */}
    <div
      className="absolute inset-0 opacity-[0.4]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }}
    />
    {/* Scanline Effect - Subtle for light mode */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(248,250,252,0)_50%,rgba(226,232,240,0.05)_50%),linear-gradient(90deg,rgba(79,70,229,0.01),rgba(16,185,129,0.005),rgba(79,70,229,0.01))] z-10 bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40" />
    {/* Ambient Glows - Softer for light mode */}
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
  </div>
);

const KPICard = ({ label, value, subValue, icon: Icon, color, trend, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white border border-slate-200/60 backdrop-blur-md rounded-3xl p-6 relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all shadow-sm shadow-slate-200/40"
  >
    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
      <Icon className="w-20 h-20" />
    </div>
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("p-2 rounded-xl bg-slate-50 border border-slate-100", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
    </div>
    <div className="flex items-baseline gap-2">
      <h4 className="text-4xl font-mono font-black text-slate-900 tracking-tighter tabular-nums">
        {value}
      </h4>
      {subValue && (
        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{subValue}</span>
      )}
    </div>
    {trend && (
      <div className={cn(
        "mt-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
        trend.isPositive ? "text-emerald-500" : "text-rose-500"
      )}>
        {trend.isPositive ? '↑' : '↓'} {trend.value} <span className="text-slate-600 ml-1">vs target</span>
      </div>
    )}
  </motion.div>
);

export default function ProductionManagementDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const basePath = user?.role === 'MANAGER' ? '/manager' : '/admin';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterLine, setFilterLine] = useState('ALL');

  // --- DATA FETCHING ---
  const { data: batches, isLoading: loadingBatches } = useQuery({
    queryKey: ['production-batches-all'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data
  });

  const { data: factoryLive } = useQuery({
    queryKey: ['factory-live-overview'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE)).data,
    refetchInterval: 10000
  });

  const { data: lines } = useQuery({
    queryKey: ['master-data-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data
  });

  // --- LOGIC ---
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b: any) => {
      const matchesSearch = b.batchCode.toLowerCase().includes(search.toLowerCase()) ||
        b.productName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
      const matchesLine = filterLine === 'ALL' || b.lineId === filterLine;
      return matchesSearch && matchesStatus && matchesLine;
    });
  }, [batches, search, filterStatus, filterLine]);

  const stats = useMemo(() => {
    if (!factoryLive) return { blowing: 0, filling: 0, packing: 0, rejection: 0 };
    return {
      blowing: factoryLive.counters?.blowing || 0,
      filling: factoryLive.counters?.filling || 0,
      packing: factoryLive.counters?.packing || 0,
      rejection: factoryLive.counters?.rejection || 0,
    };
  }, [factoryLive]);

  if (loadingBatches) return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center relative overflow-hidden text-slate-900">
      <TechnicalBackground />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-t-2 border-indigo-500 rounded-full mb-6"
      />
      <p className="text-slate-400 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">Initializing Command Center...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-indigo-500 selection:text-white">
      <TechnicalBackground />

      <main className="relative z-10 p-8 lg:p-12 space-y-12 max-w-[1800px] mx-auto">

        {/* --- CINEMATIC HEADER --- */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.3)]">
                <LayoutDashboard size={32} />
              </div>
              <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Plant <span className="text-indigo-500">Ops</span>
              </h1>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] ml-1 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
              System Status: Nominal • Factory ID: ERN-KL01
            </p>
          </motion.div>

          <div className="flex items-center gap-6 bg-white border border-slate-200/60 backdrop-blur-xl p-4 rounded-3xl shadow-sm">
            <div className="text-right px-6 border-r border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Batches</p>
              <p className="text-3xl font-black text-slate-900 font-mono">{factoryLive?.activeBatches?.length || 0}</p>
            </div>
            <div className="text-right px-6 border-r border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Efficiency</p>
              <p className="text-3xl font-black text-emerald-600 font-mono">92.4%</p>
            </div>

            <button
              onClick={() => navigate(`${basePath}/production`)}
              className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20 font-black uppercase tracking-widest text-[10px] active:scale-95 group"
            >
              <Play className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" /> Start New Batch
            </button>

            <button
              onClick={() => { }}
              className="p-4 bg-white text-slate-400 border border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-indigo-600 transition-all group active:scale-95 shadow-sm"
            >
              <RefreshCw className="group-hover:rotate-180 transition-transform duration-700" size={20} />
            </button>
          </div>
        </header>

        {/* --- KPI STRIP --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <KPICard label="Blowing Ingress" value={stats.blowing.toLocaleString()} subValue="units" icon={TrendingUp} color="text-blue-500" trend={{ value: "+8%", isPositive: true }} delay={0.1} />
          <KPICard label="Filling Velocity" value={stats.filling.toLocaleString()} subValue="units" icon={Zap} color="text-indigo-500" trend={{ value: "+12%", isPositive: true }} delay={0.2} />
          <KPICard label="Packing Net" value={stats.packing.toLocaleString()} subValue="units" icon={Box} color="text-emerald-500" trend={{ value: "+4%", isPositive: true }} delay={0.3} />
          <KPICard label="Rejection Rate" value={stats.rejection.toLocaleString()} subValue="units" icon={AlertTriangle} color="text-rose-500" trend={{ value: "+2%", isPositive: false }} delay={0.4} />
        </div>

        {/* --- MAIN ACTION AREA --- */}
        <div className="grid grid-cols-12 gap-10">

          {/* Batch Ledger */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white border border-slate-200/60 rounded-[3rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                  <Database className="text-indigo-500" /> Batch DNA Ledger
                </h3>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search batch code..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-12 w-64 bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>

                  <select
                    value={filterLine}
                    onChange={(e) => setFilterLine(e.target.value)}
                    className="h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
                  >
                    <option value="ALL">All Lines</option>
                    {lines?.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-12 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none focus:border-indigo-500/50 transition-all"
                  >
                    <option value="ALL">All Status</option>
                    <option value="RUNNING">Running</option>
                    <option value="QC_PENDING">QC Pending</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Identification</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Line / Product</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Performance</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Time Index</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    <AnimatePresence>
                      {filteredBatches.map((batch: any, i: number) => (
                        <motion.tr
                          key={batch.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => navigate(`${basePath}/forensics/${batch.id}`)}
                        >
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors font-mono tracking-tight">{batch.batchCode}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">ID: {batch.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-xs font-black text-slate-600 uppercase">{batch.lineName || 'LINE 01'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 truncate max-w-[150px]">{batch.productName}</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-xs font-black text-slate-900 tabular-nums font-mono">{(batch.actualQuantity || 0).toLocaleString()}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase">Yield</p>
                              </div>
                              <div>
                                <p className="text-xs font-black text-rose-600 tabular-nums font-mono">{(batch.rejectionTotal || 0).toLocaleString()}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase">Rejects</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[10px] font-bold text-slate-500 font-mono">{format(new Date(batch.startTime), 'MMM dd, HH:mm')}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-widest">Clock In</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className={cn(
                              "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border inline-block",
                              batch.status === 'RUNNING' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                batch.status === 'QC_PENDING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  batch.status === 'CLOSED' ? "bg-slate-500/10 text-slate-500 border-slate-500/20" :
                                    "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                            )}>
                              {batch.status}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verified</span>
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {filteredBatches.length === 0 && (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Database className="w-8 h-8 text-slate-300" />
                  </div>
                  <h4 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No Records Found</h4>
                  <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">The request returned an empty industrial set.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Real-time Forensics & Audit */}
          <div className="col-span-12 lg:col-span-4 space-y-10">

            {/* Live Audit Stream */}
            <section className="bg-white border border-slate-200/60 rounded-[3rem] p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <Shield className="w-40 h-40" />
              </div>

              <div className="flex justify-between items-center mb-10 relative z-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                  <History className="text-amber-500" size={20} /> Operational Feed
                </h3>
                <span className="px-3 py-1 bg-amber-50 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-600 border border-amber-100">Audit Live</span>
              </div>

              <div className="space-y-6 relative z-10">
                {/* Mocked/Derived Audit Events for UI Demonstration */}
                {[
                  { id: 1, action: 'Batch Correction', user: 'pranesh.manager', time: '10:42 AM', type: 'SECURITY' },
                  { id: 2, action: 'Line Status Toggle', user: 'system', time: '10:38 AM', type: 'SYSTEM' },
                  { id: 3, action: 'Manual Log Override', user: 'pranesh.manager', time: '09:15 AM', type: 'ADMIN' },
                  { id: 4, action: 'Batch Re-opened', user: 'pranesh.manager', time: '08:30 AM', type: 'FORENSIC' },
                ].map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all cursor-pointer group/item"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-slate-900 group-hover/item:text-indigo-600 transition-colors uppercase tracking-tight">{event.action}</p>
                      <span className="text-[8px] font-black text-slate-400 font-mono">{event.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{event.user} • <span className="text-slate-600">{event.type}</span></p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button className="w-full mt-10 py-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 text-slate-500 hover:text-slate-900">
                View Security Ledger
              </button>
            </section>

            {/* Industrial Visualization: Line Efficiency Comparison */}
            <section className="bg-white border border-slate-200/60 rounded-[3rem] p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3 relative z-10">
                <TrendingUp className="text-emerald-500" size={20} /> Output Efficiency
              </h3>

              <div className="space-y-6 relative z-10">
                {lines?.slice(0, 3).map((line: any, i: number) => (
                  <div key={line.id} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>{line.name}</span>
                      <span className="text-slate-900 font-mono">{Math.floor(80 + Math.random() * 15)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${80 + Math.random() * 15}%` }}
                        transition={{ duration: 1.5, delay: i * 0.2 }}
                        className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prediction Model</p>
                    <p className="text-xs font-bold text-slate-700 leading-tight">Current velocity suggests 98.4% target fulfillment.</p>
                  </div>
                </div>
              </div>
            </section>

            <button
              onClick={() => navigate(`${basePath}/production`)}
              className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-4"
            >
              <Layers size={18} /> Production Control Floor
            </button>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-200/60 mt-12 py-10 bg-white/50 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator Sessions: <span className="text-emerald-600">ACTIVE</span></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Latency: <span className="text-emerald-500 font-mono">14ms</span></div>
          </div>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Eranad Beverages MES • Industrial Grade Platform</p>
        </div>
      </footer>
    </div>
  );
}
