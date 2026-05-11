import { useState, memo, useCallback, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../services/api-client';
import {
  Activity, Play, Square, RefreshCcw, MoreVertical,
  Gauge, Loader2, X, Users, BarChart2,
  Clock, ArrowLeft, ShieldAlert, Zap,
  Settings2, ActivitySquare, History, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductionControlPage() {
  const { filters, setFilters } = useOutletContext<{ filters: any; setFilters: (f: any) => void }>();

  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/master-data/brands')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/master-data/products')).data });
  const { data: shifts } = useQuery({ queryKey: ['shifts'], queryFn: async () => (await api.get('/master-data/shifts')).data });

  const { data: lines, isLoading } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data,
    refetchInterval: 15000,
  });

  const handleBack = useCallback(() => setFilters({ lineId: 'all' }), [setFilters]);
  const handleFocus = useCallback((id: string) => setFilters({ lineId: id }), [setFilters]);

  if (isLoading) return (
    <div className="h-96 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-xl" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] animate-pulse">Synchronizing Line Telemetry...</p>
      </div>
    </div>
  );

  const isFiltered = filters?.lineId && filters.lineId !== 'all';
  const focusedLine = lines?.find((l: any) => l.id === filters.lineId);

  if (isFiltered && focusedLine) {
    return (
      <ProductionCommander
        line={focusedLine}
        onBack={handleBack}
        brands={brands}
        products={products}
        shifts={shifts}
      />
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl">
              <ActivitySquare className="w-8 h-8" />
            </div>
            Production Floor
          </h2>
          <p className="text-slate-500 font-bold mt-2 ml-1">Real-time tactical oversight of {lines?.length || 0} production units.</p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {lines?.filter((l: any) => l.status === 'RUNNING').length} Active Units
          </div>
          <div className="px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
            {lines?.filter((l: any) => l.status === 'IDLE').length} Standby
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <AnimatePresence mode="popLayout">
          {lines?.map((line: any, idx: number) => (
            <LineControlCard
              key={`${line.id}-${idx}`}
              line={line}
              onFocus={() => handleFocus(line.id)}
              brands={brands}
              products={products}
              shifts={shifts}
              idx={idx}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProductionCommander({ line, onBack, brands, products, shifts }: any) {
  const { data: stats } = useQuery({
    queryKey: ['line-performance-detail', line.id],
    queryFn: async () => (await api.get('/analytics/line-performance', { params: { lineId: line.id } })).data,
    refetchInterval: 5000
  });

  const { data: batchHistory } = useQuery({
    queryKey: ['line-batch-history', line.id],
    queryFn: async () => (await api.get(`/production/batches`, { params: { lineId: line.id, status: 'COMPLETED,CLOSED,QC_PENDING' } })).data,
  });

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl flex items-center justify-center transition-all group">
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{line.name}</h2>
              <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${line.status === 'RUNNING' ? 'bg-emerald-500 text-white animate-pulse' :
                line.status === 'CHANGEOVER' ? 'bg-amber-500 text-white animate-pulse' :
                  'bg-slate-300 text-white'
                }`}>
                {line.status}
              </span>
            </div>
            <p className="text-slate-500 font-medium mt-1">{line.description || 'Enterprise production unit.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Batch</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{line?.batch?.batchCode || 'NO BATCH'}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{line?.batch?.productName || 'No Active Product'}</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
            {line?.batch?.batchCode?.charAt(0) || '?'}
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 border border-white shadow-2xl flex flex-col items-center justify-between group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent pointer-events-none" />
              <div className="relative z-10 w-full mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Live Throughput</p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{Math.round(stats?.bpm || 0)}</h4>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">BPM</span>
                </div>
              </div>
              <div className="relative w-40 h-40 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                <svg className="w-full h-full -rotate-[220deg] transform">
                  <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f1f5f9" strokeWidth="12" strokeDasharray="330 440" strokeLinecap="round" />
                  <circle cx="80" cy="80" r="70" fill="transparent" stroke="url(#bpmGradient)" strokeWidth="12"
                    strokeDasharray={`${(Math.min((stats?.bpm || 0) / 150, 1) * 330)} 440`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="bpmGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Activity className="w-8 h-8 text-indigo-500 animate-pulse mb-1" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Running</span>
                </div>
              </div>
            </motion.div>
            <TelemetryCard label="Line Efficiency" value={`${stats?.oee || 0}%`} icon={Gauge} color="emerald" sub="OEE" delay={0.1} />
            <TelemetryCard label="Personnel" value={`${stats?.activeOperators || 0}`} icon={Users} color="blue" sub="Active" delay={0.2} />
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-[4rem] p-12 border border-white shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
            <div className="flex justify-between items-center mb-10 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Production Timeline</h3>
                <p className="text-slate-400 font-bold text-xs">Real-time station logging and event sequence.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                  <Zap className="w-3 h-3 fill-indigo-600" /> Auto-Sync
                </div>
              </div>
            </div>
            <div className="relative z-10 flex gap-6 overflow-x-auto pb-6 px-2 no-scrollbar">
              <AnimatePresence mode="popLayout">
                {stats?.recentLogs?.map((log: any, i: number) => (
                  <motion.div
                    key={`${log.timestamp}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-shrink-0 flex flex-col gap-4 p-6 bg-white border border-slate-50 rounded-[2.5rem] min-w-[200px] shadow-xl shadow-slate-200/20 hover:scale-105 transition-transform"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">{log.station}</span>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    </div>
                    <h4 className="text-2xl font-black text-slate-900">+{log.count} <span className="text-xs font-bold text-slate-400">PCS</span></h4>
                    <div className="mt-2 flex items-center gap-2 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </motion.div>
                ))}
                {(!stats?.recentLogs || stats.recentLogs.length === 0) && (
                  <div className="w-full py-12 flex flex-col items-center justify-center text-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Activity className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest opacity-40 italic">Waiting for telemetry heartbeat...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <BarChart2 className="w-40 h-40" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black tracking-tight">Output</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
                  <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-xs font-black">
                    {stats?.stats?.find((s: any) => s.station === 'PACKING')?.total || 0} Units
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                {['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map((station) => {
                  const sData = stats?.stats?.find((s: any) => s.station === station);
                  return (
                    <div key={station} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:bg-white/10 transition-all">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{station}</p>
                      <p className="text-2xl font-black">{sData?.total || 0}</p>
                      <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(((sData?.total || 0) / 5000) * 100, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── BATCH HISTORY ── */}
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Batch History</h3>
                  <p className="text-xs font-bold text-slate-400">Previous production runs on this line.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {batchHistory?.map((batch: any) => (
                <div key={batch.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                  <div className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-50 transition-colors">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-none">{batch.batchCode}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{batch.productName} • {new Date(batch.startTime).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900 leading-none">{batch.totalProduction || 0} PCS</p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1 block">{batch.status}</span>
                  </div>
                </div>
              ))}
              {(!batchHistory || batchHistory.length === 0) && (
                <div className="py-12 text-center text-slate-400 italic text-sm font-bold">
                  No previous batch records found for this unit.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Station Control</h3>
            <div className="space-y-4">
              <LineControlButtons line={line} brands={brands} products={products} shifts={shifts} />
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-20">
              <Clock className="w-20 h-20" />
            </div>
            <h3 className="text-xl font-black mb-4 relative z-10">Time Left</h3>
            <div className="text-4xl font-black tracking-tighter mb-6 relative z-10">02:44:12</div>
            <p className="text-indigo-100 text-sm font-bold relative z-10 leading-relaxed mb-8">
              Production target is 82% complete. Estimated completion time: 04:15 PM.
            </p>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden relative z-10">
              <div className="h-full bg-white w-[82%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TelemetryCard = memo(({ label, value, icon: Icon, color, sub, delay = 0 }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-2xl group hover:shadow-indigo-100 transition-all cursor-pointer overflow-hidden relative"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-lg relative z-10 group-hover:scale-110 transition-transform ${color === 'indigo' ? 'bg-indigo-600 text-white' :
        color === 'emerald' ? 'bg-emerald-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</h4>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sub}</span>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors" />
    </motion.div>
  );
});

function LineControlButtons({ line, brands, products, shifts }: any) {
  const queryClient = useQueryClient();
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [stopRemarks, setStopRemarks] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [stopEndTime, setStopEndTime] = useState(new Date().toISOString().slice(0, 16));
  const [changeoverModalOpen, setChangeoverModalOpen] = useState(false);
  const [changeoverBrand, setChangeoverBrand] = useState('');
  const [changeoverProduct, setChangeoverProduct] = useState('');
  const [materialReturns, setMaterialReturns] = useState<any>({ preforms: 0, caps: 0, labels: 0 });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-lines'] });
  };

  const startMutation = useMutation({
    mutationFn: () => api.post(`/production/start`, {
      lineId: line.id,
      shiftId: selectedShift,
      brandId: selectedBrand,
      productId: selectedProduct,
      batchCode: batchCode || undefined,
      remarks,
      startTime: new Date(startTime).toISOString()
    }),
    onSuccess: () => {
      invalidate();
      toast.success('Production started');
    }
  });

  const stopMutation = useMutation({
    mutationFn: () => {
      if (!line.batch?.id) {
        toast.error('No active batch found to close');
        throw new Error('No active batch ID');
      }
      return api.put(`/production/${line.batch.id}/close`, {
        remarks: stopRemarks,
        endTime: new Date(stopEndTime).toISOString(),
        materialReturn: materialReturns
      });
    },
    onSuccess: () => {
      invalidate();
      setStopConfirmOpen(false);
      toast.success('Production moved to QC_PENDING');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Stop failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  const changeoverMutation = useMutation({
    mutationFn: () => api.post(`/production/line/${line.id}/changeover`, {
      productId: changeoverProduct,
      batchId: line.batch?.id
    }),
    onSuccess: () => { invalidate(); setChangeoverModalOpen(false); toast.success('Changeover initiated'); },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Changeover failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  if (line.status === 'IDLE') {
    return (
      <StartProductionForm
        shifts={shifts}
        brands={brands}
        products={products}
        selectedShift={selectedShift} setSelectedShift={setSelectedShift}
        selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand}
        selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct}
        batchCode={batchCode} setBatchCode={setBatchCode}
        startTime={startTime} setStartTime={setStartTime}
        remarks={remarks} setRemarks={setRemarks}
        onSubmit={() => startMutation.mutate()}
        isPending={startMutation.isPending}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => setStopConfirmOpen(true)}
        disabled={!line.batch || stopMutation.isPending}
        className="flex flex-col items-center gap-3 p-8 bg-slate-900 text-white rounded-[2.5rem] hover:bg-black transition-all group disabled:opacity-50"
      >
        {stopMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-6 h-6 fill-white group-hover:scale-110 transition-transform" />}
        <span className="text-[10px] font-black uppercase tracking-widest">
          {stopMutation.isPending ? 'Closing...' : 'End Batch'}
        </span>
      </button>
      <button onClick={() => setChangeoverModalOpen(true)} className="flex flex-col items-center gap-3 p-8 bg-amber-500 text-white rounded-[2.5rem] hover:bg-amber-600 transition-all group">
        <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
        <span className="text-[10px] font-black uppercase tracking-widest">Changeover</span>
      </button>

      {stopConfirmOpen && (
        <Modal onClose={() => setStopConfirmOpen(false)}>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Finalize Production?</h3>
            <p className="text-slate-500 font-medium mt-2">Closing batch will trigger inventory deduction and move state to QC Pending.</p>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1">Ending Time</label>
            <input
              type="datetime-local"
              value={stopEndTime}
              onChange={(e) => setStopEndTime(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <textarea
            value={stopRemarks}
            onChange={(e) => setStopRemarks(e.target.value)}
            placeholder="End of shift remarks (optional)..."
            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-24 resize-none mb-6"
          />

          <div className="bg-slate-50 p-6 rounded-[2rem] mb-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Material Returns</h4>
            <div className="grid grid-cols-3 gap-4">
              {Object.keys(materialReturns).map(key => (
                <div key={key}>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 capitalize">{key}</label>
                  <input
                    type="number"
                    value={materialReturns[key]}
                    onChange={(e) => setMaterialReturns({ ...materialReturns, [key]: Number(e.target.value) })}
                    className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setStopConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
            <button onClick={() => stopMutation.mutate()} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-200">Confirm Close</button>
          </div>
        </Modal>
      )}

      {changeoverModalOpen && (
        <Modal onClose={() => setChangeoverModalOpen(false)}>
          <h3 className="text-xl font-black mb-4">Product Changeover</h3>
          <p className="text-slate-500 mb-6">Select the next brand and product to be produced on this line.</p>

          <div className="space-y-4 mb-8">
            <select value={changeoverBrand} onChange={(e) => { setChangeoverBrand(e.target.value); setChangeoverProduct(''); }} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4">
              <option value="">Select Brand</option>
              {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <select
              value={changeoverProduct}
              onChange={(e) => setChangeoverProduct(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 disabled:opacity-50"
              disabled={!changeoverBrand}
            >
              <option value="">Select New Product</option>
              {products?.filter((p: any) => p.brandId === changeoverBrand).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setChangeoverModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
            <button onClick={() => changeoverMutation.mutate()} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-100">Initiate</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StartProductionForm({
  shifts, brands, products,
  selectedShift, setSelectedShift,
  selectedBrand, setSelectedBrand,
  selectedProduct, setSelectedProduct,
  batchCode, setBatchCode,
  startTime, setStartTime,
  remarks, setRemarks,
  onSubmit, isPending
}: any) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Shift Configuration</label>
        <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
          <option value="">Select Shift</option>
          {shifts?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Brand</label>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
            <option value="">Select Brand</option>
            {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Product</label>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
            <option value="">Select Product</option>
            {products?.filter((p: any) => p.brandId === selectedBrand).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Number (Auto-gen if empty)</label>
        <input
          type="text"
          placeholder="e.g. NB-20260505-001"
          value={batchCode}
          onChange={(e) => setBatchCode(e.target.value)}
          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Time</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700"
        />
      </div>

      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Shift remarks (optional)..."
        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-20 resize-none"
      />
      <button
        onClick={onSubmit}
        disabled={!selectedProduct || !selectedShift || isPending}
        className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
        Commit Production Start
      </button>
    </div>
  );
}

const LineControlCard = memo(forwardRef(({ line, onFocus, brands, products, shifts, idx = 0 }: any, ref: any) => {
  const queryClient = useQueryClient();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Form State
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));

  const startMutation = useMutation({
    mutationFn: () => api.post(`/production/start`, {
      lineId: line.id,
      shiftId: selectedShift,
      brandId: selectedBrand,
      productId: selectedProduct,
      batchCode: batchCode || undefined,
      remarks,
      startTime: new Date(startTime).toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      setIsStartModalOpen(false);
      toast.success('Production started successfully');
    }
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="bg-white/80 backdrop-blur-xl rounded-[3.5rem] p-10 border border-white shadow-2xl hover:shadow-indigo-100/50 transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

      <div className="flex justify-between items-start mb-10 relative z-10">
        <div onClick={onFocus} className="flex items-center gap-6 cursor-pointer">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl group-hover:bg-indigo-600 transition-all duration-500">
            <Settings2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{line.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full ${line.status === 'RUNNING' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' :
                line.status === 'CHANGEOVER' ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' :
                  line.status === 'MAINTENANCE' ? 'bg-rose-500' :
                    'bg-slate-300'
                } ${['RUNNING', 'CHANGEOVER'].includes(line.status) ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {line.status}
              </span>
            </div>
          </div>
        </div>
        <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
        <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Efficiency Index</p>
          <p className="text-xl font-black text-slate-900 leading-none flex items-center gap-2">
            {line.status === 'RUNNING' ? '84.2%' : '0.0%'}
            <Activity className="w-4 h-4 text-emerald-500" />
          </p>
        </div>
        <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Batch</p>
          <p className="text-xl font-black text-slate-900 truncate leading-none">{line?.batch?.batchCode || 'STBY-NODE'}</p>
        </div>
      </div>

      <div className="flex gap-4 relative z-10">
        <button onClick={onFocus} className="flex-[2] py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 hover:bg-indigo-600 shadow-xl shadow-slate-200">
          Enter Commander <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>
        {line.status === 'IDLE' && (
          <button onClick={() => setIsStartModalOpen(true)} className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100">
            <Play className="w-4 h-4 fill-white" /> Start
          </button>
        )}
      </div>

      {isStartModalOpen && (
        <Modal full onClose={() => setIsStartModalOpen(false)}>
          <div className="bg-slate-50/50 p-12 rounded-[3rem] border border-slate-100 shadow-inner">
            <StartProductionForm
              shifts={shifts}
              brands={brands}
              products={products}
              selectedShift={selectedShift} setSelectedShift={setSelectedShift}
              selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand}
              selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct}
              batchCode={batchCode} setBatchCode={setBatchCode}
              startTime={startTime} setStartTime={setStartTime}
              remarks={remarks} setRemarks={setRemarks}
              onSubmit={() => startMutation.mutate()}
              isPending={startMutation.isPending}
            />
          </div>
        </Modal>
      )}
    </motion.div>
  );
}));

function Modal({ children, onClose, full = false }: { children: React.ReactNode, onClose: () => void, full?: boolean }) {
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');

    // Lock scroll
    document.body.style.overflow = 'hidden';
    if (scrollContainer) scrollContainer.style.overflow = 'hidden';

    return () => {
      // Unlock scroll
      document.body.style.overflow = '';
      if (scrollContainer) scrollContainer.style.overflow = '';
    };
  }, []);

  const content = full ? (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-8 md:p-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[4rem] w-full max-w-6xl max-h-full flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.3)] relative animate-in zoom-in-95 duration-500 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 z-20" />

        <header className="flex justify-between items-center p-12 md:p-16 border-b border-slate-50 bg-white relative z-10 shrink-0">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl">
              <ActivitySquare className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Line Command Center</h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] mt-3">Production Intelligence / System Init</p>
            </div>
          </div>
          <button onClick={onClose} className="w-16 h-16 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-[2rem] flex items-center justify-center transition-all group">
            <X className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </header>

        <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] p-12 max-w-xl w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
          <X className="w-6 h-6" />
        </button>
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
