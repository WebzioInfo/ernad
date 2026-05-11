import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PackageOpen, LogOut, Wind, Box,
  Loader2, Zap,
  AlertTriangle, Save, RefreshCw,
  Construction,
  Sparkles,
  History as HistoryIcon,
  Database,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { IndustrialNumericInput } from '../../components/ui/industrial-numeric-input';
import { ProductionSummaryCards } from './components/ProductionSummaryCards';
import { cn } from '../../lib/utils';

export default function OperatorPanel() {
  const { user } = useAuthStore();
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();

  const stations = [
    {
      id: 'BLOWING', title: 'Blowing Station', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
      materials: ['Preforms'], category: 'Preforms'
    },
    {
      id: 'FILLING', title: 'Filling Station', icon: PackageOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
      materials: ['Caps'], category: 'Caps'
    },
    {
      id: 'LABELING', title: 'Labeling Station', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
      materials: ['Labels'], category: 'Labels'
    },
    {
      id: 'PACKING', title: 'Packing Station', icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
      materials: ['Shrink Rolls', 'Cartons'], category: 'Shrink Rolls'
    },
  ];

  const { data: session, isLoading: isLoadingSession } = useQuery({
    queryKey: ['current-operator-session'],
    queryFn: async () => (await api.get('/operator/session/current')).data,
  });

  const currentStationId = urlStation?.toUpperCase() || session?.station || 'FILLING';
  const currentStation = stations.find(s => s.id === currentStationId) || stations[1];

  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [line, setLine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Entry State
  const [primaryCount, setPrimaryCount] = useState(0);
  const [wastageCount, setWastageCount] = useState(0);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [eventType, setEventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  
  // Enterprise State
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [boxCount, setBoxCount] = useState(0);
  const [packingConfigId, setPackingConfigId] = useState<string>('');
  const [shrinkWeight, setShrinkWeight] = useState(0);
  const [shrinkRejection, setShrinkRejection] = useState(0);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Refs for keyboard navigation
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const rejectionInputRef = useRef<HTMLInputElement>(null);
  const wasteInputRef = useRef<HTMLInputElement>(null);

  const endSessionMutation = useMutation({
    mutationFn: () => api.post('/operator/session/end'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      navigate('/line/select');
    }
  });

  const { data: inventory } = useQuery({
    queryKey: ['operator-inventory', currentStationId],
    queryFn: async () => (await api.get('/inventory')).data
  });

  const { data: packingConfigs } = useQuery({
    queryKey: ['packing-configs', activeBatch?.batch?.productId],
    queryFn: async () => {
      if (!activeBatch?.batch?.productId) return [];
      return (await api.get(`/inventory/packaging/${activeBatch.batch.productId}`)).data;
    },
    enabled: !!activeBatch?.batch?.productId
  });

  useEffect(() => {
    if (!isLoadingSession && !session) navigate('/line/select');
  }, [session, isLoadingSession, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchRes, linesRes] = await Promise.all([
          api.get(`/production-batch/active/${lineId}`),
          api.get(`/master-data/lines`)
        ]);
        setActiveBatch(batchRes.data);
        setLine(linesRes.data?.find((l: any) => l.id === lineId) || linesRes.data?.[0] || null);
      } catch (err) {
        console.error('Data fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    if (lineId) fetchData();
  }, [lineId]);

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['station-log-history', activeBatch?.batch?.id, currentStation.id],
    queryFn: async () => {
      if (!activeBatch?.batch?.id) return [];
      return (await api.get(`/telemetry/history/${activeBatch.batch.id}/${currentStation.id}`)).data;
    },
    enabled: !!activeBatch?.batch?.id,
  });

  const handleSaveTelemetry = async (type: 'ALL' | 'COUNT' | 'EVENT' | 'WASTE' = 'ALL') => {
    if (!activeBatch?.batch && !session?.batchId) {
      return toast.error('No active batch found.');
    }

    if (activeBatch?.batch?.status === 'QC_PENDING' || activeBatch?.batch?.status === 'COMPLETED') {
      return toast.error(`Production is FROZEN for Batch ${activeBatch?.batch?.batchCode}. Status: ${activeBatch?.batch?.status}`);
    }

    if (isSubmitting) return;

    // Fast Validations
    if (type === 'COUNT' && primaryCount === 0) return toast.error('Enter production count');
    if (type === 'WASTE' && wastageCount === 0) return toast.error('Enter wastage count');
    
    // Industrial Rule: Material Source must be selected for Production Stations
    if ((type === 'ALL' || type === 'COUNT') && !selectedStock && currentStation.id !== 'PACKING') {
      return toast.error('MATERIAL_BATCH_REQUIRED: Select the current material batch (Preform/Cap/Label) being used.');
    }

    const currentBatch = activeBatch?.batch;
    const logEntry = {
      requestId: uuidv4(),
      batchId: currentBatch?.id || session?.batchId,
      sessionId: session.id,
      lineId: lineId!,
      brandId: currentBatch?.brandId || session?.brandId,
      productId: currentBatch?.productId || session?.productId,
      shiftId: currentBatch?.shiftId || session?.shiftId,
      station: currentStation.id,
      primaryCount: Math.floor(primaryCount),
      wastageCount: Math.floor(wastageCount),
      eventType: type === 'EVENT' ? eventType : 'NORMAL_PRODUCTION',
      isRework: false,
      selectedStockId: selectedStock,

      // Enterprise Extensions
      capUsage: currentStation.id === 'FILLING' ? primaryCount : 0,
      capRejection: currentStation.id === 'FILLING' ? rejectionCount : 0,
      preformUsage: currentStation.id === 'BLOWING' ? primaryCount : 0,
      preformRejection: currentStation.id === 'BLOWING' ? rejectionCount : 0,
      bopRollUsage: currentStation.id === 'LABELING' ? primaryCount : 0,
      bopRejection: currentStation.id === 'LABELING' ? rejectionCount : 0,
      shrinkWeightUsed: currentStation.id === 'PACKING' ? shrinkWeight : 0,
      shrinkWeightRejected: currentStation.id === 'PACKING' ? shrinkRejection : 0,
      casesProduced: currentStation.id === 'PACKING' ? Math.floor(primaryCount / (packingConfigs?.find((c: any) => c.id === packingConfigId)?.bottlesPerCase || 1)) : 0,
      packingTypeId: packingConfigId,
      finishedGoodsProduced: currentStation.id === 'PACKING' ? primaryCount : 0,
      boxCount: boxCount,
      remarks: type === 'EVENT' ? remarks : '',
      loggedAt: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      await api.post('/telemetry', logEntry);
      toast.success('Telemetry logged successfully');
      refetchHistory();
      
      // Reset logic
      setPrimaryCount(0);
      setWastageCount(0);
      setRejectionCount(0);
      setBoxCount(0);
      setShrinkWeight(0);
      setShrinkRejection(0);
      if (type === 'EVENT') {
        setEventType('NORMAL_PRODUCTION');
        setRemarks('');
      }
      
      // INDUSTRIAL HARDENING: Ensure focus returns to primary input for rapid entry
      setTimeout(() => {
        primaryInputRef.current?.focus();
        primaryInputRef.current?.select();
      }, 50);
      
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = {
    target: activeBatch?.batch?.targetQuantity || 0,
    actual: activeBatch?.batch?.actualQuantity || 0,
    rejectionRate: ((rejectionCount / (primaryCount || 1)) * 100).toFixed(1),
    eta: '2h 15m'
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Modern Header */}
      <header className="px-10 py-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-3xl sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-2xl ${currentStation.bg} border ${currentStation.border} shadow-2xl`}>
              <currentStation.icon className={`w-8 h-8 ${currentStation.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-white uppercase tracking-tight">Line {line?.name || lineId}</h1>
                <div className="h-4 w-px bg-white/10" />
                <span className={`text-sm font-bold ${currentStation.color} uppercase tracking-widest`}>{currentStation.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Live Terminal • <span className="text-slate-300">{session?.startTime ? formatDistanceToNow(new Date(session.startTime)) : '...'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12">
            <div className="text-right hidden md:block">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-0.5">Active Operator</span>
              <p className="text-sm font-black text-white">{user?.name}</p>
            </div>
            <button
              onClick={() => endSessionMutation.mutate()}
              className="px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 hover:bg-rose-500 hover:text-white transition-all active:scale-95 group"
            >
              <LogOut className="w-4 h-4 text-rose-400 group-hover:text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest">End Session</span>
            </button>
        </div>
      </header>

      <main className="flex-1 p-10 max-w-[1600px] mx-auto w-full grid grid-cols-12 gap-10">
        {loading ? (
          <div className="col-span-12 h-96 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Top Stats Section */}
            <div className="col-span-12">
              <ProductionSummaryCards stats={stats} />
            </div>

            {/* Left Column: Data Entry Forms (8 cols) */}
            <div className="col-span-8 flex flex-col gap-8">
              {/* Main Production Form */}
              <section className="bg-white/5 border border-white/10 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Production Entry</h2>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Batch: {activeBatch?.batch?.batchCode}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  {/* Production Input */}
                  <div className="col-span-1 space-y-6">
                    <IndustrialNumericInput
                      ref={primaryInputRef}
                      label={`${currentStation.id === 'PACKING' ? 'Finished Goods' : 'Production'} Count`}
                      value={primaryCount}
                      onChange={setPrimaryCount}
                      placeholder="Enter quantity..."
                      onKeyDown={(e) => e.key === 'Enter' && rejectionInputRef.current?.focus()}
                      autoFocus
                    />
                    
                    <IndustrialNumericInput
                      ref={rejectionInputRef}
                      label="Rejection / QC Fail"
                      value={rejectionCount}
                      onChange={setRejectionCount}
                      placeholder="Enter rejections..."
                      className="opacity-80 focus-within:opacity-100 transition-opacity"
                      onKeyDown={(e) => e.key === 'Enter' && wasteInputRef.current?.focus()}
                    />
                  </div>

                  {/* Secondary Inputs & Stock */}
                  <div className="col-span-1 space-y-6">
                     <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Material Source Batch</label>
                      <div className="relative">
                        <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                          value={selectedStock}
                          onChange={(e) => setSelectedStock(e.target.value)}
                          className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 text-sm font-bold text-white appearance-none outline-none focus:border-indigo-500/50 transition-all"
                        >
                          <option value="">Select Stock Item...</option>
                          {inventory?.map((item: any) => (
                            <option key={item.id} value={item.id}>{item.itemName} ({item.quantity} {item.unit})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {currentStation.id === 'PACKING' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Packaging Config</label>
                        <div className="relative">
                          <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <select
                            value={packingConfigId}
                            onChange={(e) => setPackingConfigId(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 text-sm font-bold text-white appearance-none outline-none focus:border-indigo-500/50 transition-all"
                          >
                            <option value="">Standard Pack...</option>
                            {packingConfigs?.map((config: any) => (
                              <option key={config.id} value={config.id}>{config.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <IndustrialNumericInput
                      ref={wasteInputRef}
                      label="Process Wastage"
                      value={wastageCount}
                      onChange={setWastageCount}
                      placeholder="Enter wastage..."
                      suffix={currentStation.id === 'PACKING' ? 'KG' : 'PCS'}
                    />
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex gap-4">
                   <button
                    onClick={() => handleSaveTelemetry('ALL')}
                    disabled={isSubmitting}
                    className="flex-1 h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Log Full Telemetry
                  </button>
                  <button
                    onClick={() => { setPrimaryCount(0); setRejectionCount(0); setWastageCount(0); }}
                    className="px-8 h-16 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Clear Form
                  </button>
                </div>
              </section>

              {/* Event / Downtime Logger */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Activity className="w-4 h-4 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Process Event Logger</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {['NORMAL_PRODUCTION', 'POWER_FAILURE', 'MACHINE_BREAKDOWN', 'MATERIAL_SHORTAGE', 'LOW_SPEED', 'DOWNTIME_PAUSE'].map(type => (
                    <button
                      key={type}
                      onClick={() => setEventType(type)}
                      className={cn(
                        "py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        eventType === type ? "bg-amber-500 border-amber-400 text-black" : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
                      )}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-4">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter downtime reason or technical remarks..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-300 resize-none outline-none focus:border-amber-500/50 min-h-[80px]"
                  />
                  <button
                    onClick={() => handleSaveTelemetry('EVENT')}
                    className="w-48 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    Log Event
                  </button>
                </div>
              </section>
            </div>

            {/* Right Column: History Feed (4 cols) */}
            <div className="col-span-4 flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[calc(100vh-320px)]">
                <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HistoryIcon className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Live Activity Feed</h3>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  <AnimatePresence mode='popLayout'>
                    {!history || history.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <HistoryIcon className="w-12 h-12 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No logs recorded</p>
                      </div>
                    ) : (
                      history.map((log: any, i: number) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={log.id || log.requestId}
                          className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                log.eventType === 'NORMAL_PRODUCTION' ? "bg-emerald-500" : "bg-rose-500"
                              )} />
                              <span className="text-sm font-black text-white">+{log.primaryCount}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                              <Clock className="w-3 h-3" />
                              {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">{log.eventType.replace('_', ' ')}</span>
                            {log.wastageCount > 0 && <span className="text-rose-500">Waste: {log.wastageCount}</span>}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Mini Machine Status Card */}
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Telemetry Status</p>
                  <p className="text-xs font-bold text-white">Encrypted & Synchronized</p>
                </div>
                <Sparkles className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Industrial Footer Action Bar */}
      <footer className="px-10 py-6 bg-black border-t border-white/5 flex justify-between items-center sticky bottom-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Uplink Stable</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MES Core v4.0</span>
          </div>
        </div>
        
        <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.5em] pr-2">
          ERNAD INTELLIGENT MANUFACTURING
        </p>
      </footer>
    </div>
  );
}
