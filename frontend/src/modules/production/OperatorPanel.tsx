import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PackageOpen, LogOut, Wind, Box,
  Loader2, Zap,
  AlertTriangle, Save, RefreshCw,
  Construction,
  Sparkles,
  History as HistoryIcon,
  ChevronDown,
  Database,
  Layers
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function OperatorPanel() {
  const { user } = useAuthStore();
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();

  const stations = [
    {
      id: 'BLOWING', title: 'Blowing Station', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
      materials: ['Preforms'],
      category: 'Preforms',
      increments: [1000, 500, 100, 50, 20, 10, 5, 1],
      wasteIncrements: [50, 10, 5, 1]
    },
    {
      id: 'FILLING', title: 'Filling Station', icon: PackageOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
      materials: ['Caps'],
      category: 'Caps',
      increments: [500, 100, 50, 20, 10, 5, 2, 1],
      wasteIncrements: [20, 10, 5, 1]
    },
    {
      id: 'LABELING', title: 'Labeling Station', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
      materials: ['Labels'],
      category: 'Labels',
      increments: [500, 100, 50, 20, 10, 5, 2, 1],
      wasteIncrements: [20, 10, 5, 1]
    },
    {
      id: 'PACKING', title: 'Packing Station', icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
      materials: ['Shrink Rolls', 'Cartons'],
      category: 'Shrink Rolls',
      increments: [100, 50, 20, 10, 5, 2, 1],
      wasteIncrements: [10, 5, 2, 1]
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
  const [primaryCount, setPrimaryCount] = useState(0);
  const [splitValues, setSplitValues] = useState<number[]>([]);
  const [wastageCount, setWastageCount] = useState(0);
  const [eventType, setEventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);

  // Enterprise State
  const [selectedStock, setSelectedStock] = useState<Record<string, string>>({}); // { BLOWING: stockId, ... }
  const [rejections, setRejections] = useState<Record<string, number>>({
    BLOWING: 0,
    FILLING: 0,
    LABELING: 0,
    PACKING: 0
  });
  const [boxCount, setBoxCount] = useState(0);
  const [packingConfigId, setPackingConfigId] = useState<string>('');
  const [shrinkWeight, setShrinkWeight] = useState(0);
  const [shrinkRejection, setShrinkRejection] = useState(0);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const endSessionMutation = useMutation({
    mutationFn: () => api.post('/operator/session/end'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      navigate('/line/select');
    }
  });

  // Enterprise Inventory Fetching
  const { data: inventory } = useQuery({
    queryKey: ['operator-inventory', currentStationId],
    queryFn: async () => {
      return (await api.get('/inventory')).data;
    }
  });

  const { data: packingConfigs } = useQuery({
    queryKey: ['packing-configs', activeBatch?.batch?.productId],
    queryFn: async () => {
      if (!activeBatch?.batch?.productId) return [];
      return (await api.get(`/inventory/packaging/${activeBatch.batch.productId}`)).data;
    },
    enabled: !!activeBatch?.batch?.productId
  });

  // Redirect if no session and not loading
  useEffect(() => {
    if (!isLoadingSession && !session) {
      navigate('/line/select');
    }
  }, [session, isLoadingSession, navigate]);


  const [activeRightTab, setActiveRightTab] = useState<'HISTORY' | 'MATERIAL' | 'WASTAGE' | 'EVENTS'>('HISTORY');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchRes, linesRes] = await Promise.all([
          api.get(`/production-batch/active/${lineId}`),
          api.get(`/master-data/lines`)
        ]);
        setActiveBatch(batchRes.data);
        const matchedLine = linesRes.data?.find((l: any) => l.id === lineId) || linesRes.data?.[0] || null;
        setLine(matchedLine);
      } catch (err) {
        console.error('Data fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    if (lineId) fetchData();
  }, [lineId]);

  const adjustSplitValue = (val: number, isAdd: boolean = true) => {
    if (!Number.isInteger(val)) {
      toast.error('Only whole number counts are allowed.');
      return;
    }

    if (isAdd) {
      setSplitValues(prev => [...prev, val]);
      setPrimaryCount(prev => prev + val);
    } else {
      if (primaryCount - val < 0) {
        toast.error('Count cannot be less than 0.');
        return;
      }
      setSplitValues(prev => [...prev, -val]);
      setPrimaryCount(prev => prev - val);
    }
  };

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['station-log-history', activeBatch?.batch?.id, currentStation.id],
    queryFn: async () => {
      if (!activeBatch?.batch?.id) return [];
      return (await api.get(`/telemetry/history/${activeBatch.batch.id}/${currentStation.id}`)).data;
    },
    enabled: !!activeBatch?.batch?.id,
  });

  const handleSaveToOffline = async (type: 'ALL' | 'COUNT' | 'EVENT' | 'MATERIAL' | 'WASTE' = 'ALL') => {
    if (!activeBatch?.batch && !session?.batchId) {
      return toast.error('No active batch found. Please wait for sync.');
    }

    const currentBatch = activeBatch?.batch;
    const isManual = type !== 'ALL';

    if (isSubmitting) return;

    // Validation based on type
    if (type === 'COUNT' && primaryCount === 0) return toast.error('Enter count first');
    if (type === 'EVENT' && eventType === 'NORMAL_PRODUCTION' && !remarks) return toast.error('Add remarks for event');
    if (type === 'MATERIAL' && materials.length === 0) return toast.error('Add materials first');
    if (type === 'WASTE' && wastageCount === 0) return toast.error('Enter wastage first');
    if (type === 'ALL' && primaryCount === 0 && wastageCount === 0 && materials.length === 0 && eventType === 'NORMAL_PRODUCTION') {
      return toast.error('Nothing to log');
    }

    // SANITIZE SPLIT VALUES AND TOTAL
    const sanitizedValues = splitValues.map(v => Math.floor(Number(v) || 0));
    const calculatedPrimary = sanitizedValues.reduce((a, b) => a + b, 0);
    const safePrimaryCount = (type === 'ALL' || type === 'COUNT') ? (calculatedPrimary > 0 ? calculatedPrimary : Math.floor(Number(primaryCount) || 0)) : 0;
    const safeWastageCount = (type === 'ALL' || type === 'WASTE') ? Math.floor(Number(wastageCount) || 0) : 0;

    // Reject un-sanitized leftover decimals (Safety Net)
    if (splitValues.some(v => !Number.isInteger(v)) || !Number.isInteger(primaryCount) || !Number.isInteger(wastageCount)) {
      return toast.error('Only whole number counts are allowed.');
    }

    const logEntry = {
      requestId: uuidv4(),
      batchId: currentBatch?.id || session?.batchId,
      sessionId: session.id,
      lineId: lineId!,
      brandId: currentBatch?.brandId || session?.brandId,
      productId: currentBatch?.productId || session?.productId,
      shiftId: currentBatch?.shiftId || session?.shiftId,
      station: currentStation.id,
      primaryCount: safePrimaryCount,
      splitValues: sanitizedValues,
      wastageCount: safeWastageCount,
      eventType: (type === 'ALL' || type === 'EVENT') ? eventType : 'NORMAL_PRODUCTION',
      isRework: false,
      materials: (type === 'ALL' || type === 'MATERIAL') ? materials : [],
      selectedStockId: selectedStock[currentStation.id],

      // Enterprise Extensions
      capUsage: currentStation.id === 'FILLING' ? safePrimaryCount : 0,
      capRejection: currentStation.id === 'FILLING' ? rejections.FILLING : 0,
      preformUsage: currentStation.id === 'BLOWING' ? safePrimaryCount : 0,
      preformRejection: currentStation.id === 'BLOWING' ? rejections.BLOWING : 0,
      bopRollUsage: currentStation.id === 'LABELING' ? safePrimaryCount : 0,
      bopRejection: currentStation.id === 'LABELING' ? rejections.LABELING : 0,
      shrinkWeightUsed: currentStation.id === 'PACKING' ? shrinkWeight : 0,
      shrinkWeightRejected: currentStation.id === 'PACKING' ? shrinkRejection : 0,
      casesProduced: currentStation.id === 'PACKING' ? Math.floor(safePrimaryCount / (packingConfigs?.find((c: any) => c.id === packingConfigId)?.bottlesPerCase || 1)) : 0,
      packingTypeId: packingConfigId,
      finishedGoodsProduced: currentStation.id === 'PACKING' ? safePrimaryCount : 0,
      boxCount: boxCount,

      remarks: (type === 'ALL' || type === 'EVENT') ? remarks : '',
      loggedAt: new Date().toISOString()
    };

    try {
      setIsSubmitting(true);
      // Send directly to API
      await api.post('/telemetry', logEntry);

      const successMsg = isManual
        ? `Logged ${type.toLowerCase()} successfully`
        : `${safePrimaryCount} units logged successfully for ${currentStation.title}`;

      toast.success(successMsg, {
        icon: '✅',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff',
          border: '1px solid #10b981',
        },
      });

      refetchHistory();

      // Selective reset
      if (type === 'ALL' || type === 'COUNT') {
        setPrimaryCount(0);
        setSplitValues([]);
      }
      if (type === 'ALL' || type === 'WASTE') {
        setWastageCount(0);
      }
      if (type === 'ALL' || type === 'MATERIAL') {
        setMaterials([]);
      }
      if (type === 'ALL' || type === 'EVENT') {
        setEventType('NORMAL_PRODUCTION');
        setRemarks('');
      }

      // Enterprise Reset
      if (type === 'ALL' || type === 'COUNT') {
        setRejections(prev => ({ ...prev, [currentStation.id]: 0 }));
        setBoxCount(0);
        setShrinkWeight(0);
        setShrinkRejection(0);
      }

    } catch (err: any) {
      const msg = err.response?.data?.message || 'Connection Error: Failed to save log';
      toast.error(typeof msg === 'string' ? msg : 'Validation Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white font-sans">
      {/* Ultra-Premium Header */}
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-blue-500/5" />

        <div className="flex items-center gap-10 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-[1.5rem] ${currentStation.bg} border ${currentStation.border} shadow-2xl`}>
              <currentStation.icon className={`w-8 h-8 ${currentStation.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white uppercase">Line {line?.name || lineId}</h1>
                <div className="h-4 w-px bg-white/10" />
                <span className={`text-sm font-bold ${currentStation.color} uppercase tracking-[0.2em]`}>{currentStation.title}</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-black">
                Session Active: <span className="text-slate-300 ml-1">{session?.startTime ? formatDistanceToNow(new Date(session.startTime)) : '...'}</span>
              </p>
            </div>
          </div>

          <div className="h-12 w-px bg-white/5" />

          {/* Critical Batch Info */}
          <div className="flex gap-12">
            <div className="group cursor-default">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] block mb-1 group-hover:text-indigo-400 transition-colors">Active Batch</span>
              <span className="text-lg font-mono font-black text-white group-hover:text-indigo-200 transition-colors">{activeBatch?.batch?.batchCode || '---'}</span>
            </div>
            <div className="group cursor-default">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] block mb-1 group-hover:text-blue-400 transition-colors">Production Brand</span>
              <span className="text-lg font-black text-blue-400 group-hover:text-blue-300 transition-colors">{activeBatch?.batch?.brandName || '---'}</span>
            </div>
            <div className="group cursor-default">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] block mb-1 group-hover:text-emerald-400 transition-colors">Target Product</span>
              <span className="text-lg font-black text-emerald-400 group-hover:text-emerald-300 transition-colors">{activeBatch?.batch?.productName || '---'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 relative z-10">
          <div className="text-right">
            <p className="text-sm font-black text-white">{user?.name}</p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Operator</p>
            </div>
          </div>
          <button
            onClick={() => endSessionMutation.mutate()}
            disabled={endSessionMutation.isPending}
            className="group relative"
          >
            <div className="absolute inset-0 bg-rose-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
            <div className="relative px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 hover:bg-rose-500 hover:border-rose-400 transition-all active:scale-95">
              {endSessionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 text-rose-400 group-hover:text-white" />}
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 group-hover:text-white">End Session</span>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 grid grid-cols-12 gap-8 lg:overflow-hidden">
        {loading ? (
          <div className="col-span-12 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Telemetry Deck...</p>
            </div>
          </div>
        ) : line?.status === 'MAINTENANCE' ? (
          <div className="col-span-12 flex items-center justify-center flex-col text-center">
            <div className="w-32 h-32 bg-rose-500/10 text-rose-500 rounded-[3rem] flex items-center justify-center mb-8 border border-rose-500/20 shadow-2xl">
              <Construction className="w-16 h-16" />
            </div>
            <p className="text-4xl font-black uppercase tracking-tighter text-white">Line Under Maintenance</p>
            <p className="text-slate-400 mt-4 max-w-md font-bold text-lg leading-relaxed">This production line is currently offline for technical service. Production logging is disabled for safety.</p>
          </div>
        ) : !activeBatch ? (
          <div className="col-span-12 flex items-center justify-center flex-col">
            <div className="w-32 h-32 bg-amber-500/10 text-amber-500 rounded-[3rem] flex items-center justify-center mb-8 border border-amber-500/20 shadow-2xl">
              <AlertTriangle className="w-16 h-16" />
            </div>
            <p className="text-4xl font-black uppercase tracking-tighter text-white">No Active Batch</p>
            <p className="text-slate-400 mt-4 max-w-md font-bold text-lg leading-relaxed">This production line is waiting for a supervisor to initiate a new batch run.</p>
          </div>
        ) : (
          <div className="col-span-12 grid grid-cols-12 gap-8 h-full overflow-hidden">
            {activeBatch.status === 'CHANGEOVER' && (
              <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center">
                <div className="text-center p-16 bg-white/5 border border-white/10 rounded-[4rem] shadow-2xl max-w-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-amber-500/10 text-amber-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 animate-pulse border border-amber-500/20">
                      <RefreshCw className="w-12 h-12" />
                    </div>
                    <h2 className="text-4xl font-black mb-6 uppercase tracking-tight text-white">Product Changeover</h2>
                    <p className="text-slate-400 font-bold text-xl leading-relaxed">
                      Reconfiguring line for:
                      <span className="text-amber-400 block mt-3 text-3xl font-black tracking-tight">{activeBatch.product?.name}</span>
                    </p>
                    <div className="mt-12 p-8 bg-black/40 border border-white/5 rounded-3xl">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3">Hardware Sync</p>
                      <p className="text-sm font-bold text-slate-400 italic">Adjusting guide rails and filling nozzles... Please stand clear.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Left: Logging Controls (8 cols) */}
            <div className="col-span-8 flex flex-col gap-8 h-full pr-2">
              <div className="bg-white/5 rounded-[3rem] p-10 border border-white/10 flex flex-col items-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Total Real-Time Production Output</p>
                <div className={`text-[12rem] font-black tabular-nums tracking-tighter leading-none mb-12 filter drop-shadow-[0_0_50px_rgba(79,70,229,0.3)] ${currentStation.color}`}>
                  {primaryCount}
                </div>

                {splitValues.length > 0 && (
                  <div className="flex gap-3 flex-wrap justify-center mb-10 max-h-20 overflow-y-auto custom-scrollbar px-10">
                    {splitValues.map((v, i) => (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={i}
                        className={`px-4 py-1.5 bg-white/5 rounded-full text-xs font-black border border-white/10 ${v > 0 ? currentStation.color : 'text-rose-400'}`}
                      >
                        {v > 0 ? '+' : ''}{v}
                      </motion.span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 w-full max-w-4xl flex-1">
                  {currentStation.increments?.slice(0, 4).map(val => (
                    <div key={val} className="flex gap-2 w-full">
                      <button
                        onClick={() => adjustSplitValue(val, false)}
                        disabled={primaryCount - val < 0}
                        className={`w-1/3 py-8 ${currentStation.bg.replace('10', '20')} hover:${currentStation.bg.replace('10', '40')} border ${currentStation.border} text-white rounded-l-[1.5rem] font-black text-2xl shadow-xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        -
                      </button>
                      <button
                        onClick={() => adjustSplitValue(val, true)}
                        className={`w-2/3 py-8 ${currentStation.bg.replace('10', '20')} hover:${currentStation.bg.replace('10', '40')} border ${currentStation.border} text-white rounded-r-[1.5rem] font-black text-2xl shadow-xl active:scale-95 transition-all group overflow-hidden relative`}
                      >
                        <div className="relative z-10">{val}</div>
                        <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  ))}
                  {currentStation.increments?.slice(4).map(val => (
                    <div key={val} className="flex gap-2 w-full">
                      <button
                        onClick={() => adjustSplitValue(val, false)}
                        disabled={primaryCount - val < 0}
                        className="w-1/3 py-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded-l-[1.5rem] font-black text-xl border border-white/5 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <button
                        onClick={() => adjustSplitValue(val, true)}
                        className="w-2/3 py-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded-r-[1.5rem] font-black text-xl border border-white/5 active:scale-95 transition-all"
                      >
                        +{val}
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-6">
                  * Production counts must be whole numbers.
                </p>

                <div className="mt-12 flex gap-4 w-full max-w-4xl">
                  <button
                    onClick={() => handleSaveToOffline('COUNT')}
                    disabled={isSubmitting}
                    className={`flex-1 py-6 bg-white/5 hover:bg-white/10 border ${currentStation.border} rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50`}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? 'Processing...' : 'Log Output Only'}
                  </button>
                  <button
                    onClick={() => { setPrimaryCount(0); setSplitValues([]); }}
                    disabled={isSubmitting}
                    className="px-8 py-6 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Commit All */}
              <button
                onClick={() => handleSaveToOffline('ALL')}
                disabled={isSubmitting}
                className="w-full py-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[3rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl shadow-indigo-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-6 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                {isSubmitting ? 'Processing Telemetry...' : 'Commit Full Telemetry Log'}
              </button>
            </div>

            {/* Right: History & Events (4 cols) */}
            <div className="col-span-4 flex flex-col gap-6 h-full pr-2">
              {/* Tab Navigation */}
              <div className="flex bg-white/5 rounded-2xl p-2 border border-white/10">
                {[
                  { id: 'HISTORY', label: 'Feed' },
                  { id: 'MATERIAL', label: 'Material' },
                  { id: 'WASTAGE', label: 'Waste' },
                  { id: 'EVENTS', label: 'Events' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveRightTab(tab.id as any)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeRightTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Event Selector */}
              {activeRightTab === 'EVENTS' && (
                <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 flex-1 flex flex-col">
                  <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6">Process Status</h3>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {['NORMAL_PRODUCTION', 'POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'DOWNTIME_PAUSE'].map(type => (
                      <button
                        key={type}
                        onClick={() => setEventType(type)}
                        className={`p-4 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest text-center ${eventType === type
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                          : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                          }`}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Technical remarks or event details..."
                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-xs font-medium text-slate-300 flex-1 resize-none focus:border-indigo-500/50 outline-none transition-colors"
                  />
                  <button
                    onClick={() => handleSaveToOffline('EVENT')}
                    className="w-full mt-4 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Log Process Event
                  </button>
                </div>
              )}

              {/* Log History */}
              {activeRightTab === 'HISTORY' && (
                <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 flex-1 flex flex-col overflow-hidden shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Batch Log Feed</h3>
                    <div className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/5">
                      Live Session
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                    {!history || history.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                        <HistoryIcon className="w-10 h-10 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No logs recorded yet</p>
                      </div>
                    ) : (
                      history.map((log: any, i: number) => (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={log.id || log.requestId}
                          className="p-5 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${log.eventType === 'NORMAL_PRODUCTION' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className="text-xs font-black text-white">+{log.primaryCount}</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-600 group-hover:text-slate-400 transition-colors">
                              {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{log.eventType.replace('_', ' ')}</span>
                            {log.wastageCount > 0 && (
                              <span className="text-[9px] font-black text-rose-500 uppercase">Waste: {log.wastageCount}</span>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Enterprise Material Intake */}
              {activeRightTab === 'MATERIAL' && (
                <div className={`${currentStation.bg} rounded-[2.5rem] p-8 border ${currentStation.border} shadow-xl flex-1 flex flex-col`}>
                  <h3 className={`text-[10px] font-black ${currentStation.color} uppercase tracking-[0.3em] mb-6`}>Material Resource Log</h3>

                  <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {/* Item Selector */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Stock Item</label>
                      <div className="relative group">
                        <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                          value={selectedStock[currentStation.id] || ''}
                          onChange={(e) => setSelectedStock(prev => ({ ...prev, [currentStation.id]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white appearance-none outline-none focus:border-indigo-500/50 transition-all"
                        >
                          <option value="">Select Stock Batch...</option>
                          {inventory?.filter((i: any) => i.itemName.includes(currentStation.category) || i.categoryName === currentStation.category).map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.itemName} ({item.quantity} {item.unit})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* Packaging Config for Packing Station */}
                    {currentStation.id === 'PACKING' && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Packaging Configuration</label>
                        <div className="relative">
                          <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <select
                            value={packingConfigId}
                            onChange={(e) => setPackingConfigId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white appearance-none outline-none focus:border-indigo-500/50 transition-all"
                          >
                            <option value="">Standard Pack...</option>
                            {packingConfigs?.map((config: any) => (
                              <option key={config.id} value={config.id}>{config.name} ({config.bottlesPerCase} btl)</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Shrink Weight Tracking */}
                    {currentStation.id === 'PACKING' && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shrink Consumption (Kg)</span>
                          <span className="text-xl font-black text-amber-500">{shrinkWeight}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[0.1, 0.5, 1, 5].map(v => (
                            <button
                              key={v}
                              onClick={() => setShrinkWeight(prev => Number((prev + v).toFixed(2)))}
                              className="py-4 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black border border-white/5"
                            >
                              +{v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filling Station Box Count */}
                    {currentStation.id === 'FILLING' && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Box Count Logged</span>
                          <span className="text-xl font-black text-emerald-500">{boxCount}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[1, 5, 10, 50].map(v => (
                            <button
                              key={v}
                              onClick={() => setBoxCount(prev => prev + v)}
                              className="py-4 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black border border-white/5"
                            >
                              +{v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleSaveToOffline('MATERIAL')}
                    className={`w-full mt-4 py-5 ${currentStation.bg.replace('10', '20')} hover:${currentStation.bg.replace('10', '30')} border ${currentStation.border} rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95`}
                  >
                    <Box className="w-4 h-4" /> Save Material State
                  </button>
                </div>
              )}

              {/* Wastage */}
              {activeRightTab === 'WASTAGE' && (
                <div className="bg-rose-500/10 rounded-[2.5rem] p-8 border border-rose-500/20 shadow-2xl relative overflow-hidden flex-1 flex flex-col">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <AlertTriangle className="w-12 h-12 text-rose-500" />
                  </div>
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-1">
                        {currentStation.id === 'PACKING' ? 'Shrink Reject (Kg)' : `${currentStation.category} Reject`}
                      </h3>
                      <div className="text-6xl font-black text-rose-500 tabular-nums tracking-tighter leading-none">
                        {currentStation.id === 'PACKING' ? shrinkRejection : rejections[currentStation.id]}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (currentStation.id === 'PACKING') setShrinkRejection(0);
                        else setRejections(prev => ({ ...prev, [currentStation.id]: 0 }));
                        setWastageCount(0);
                      }}
                      className="p-3 bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {(currentStation.id === 'PACKING' ? [0.1, 0.5, 1, 5] : currentStation.wasteIncrements)?.map((v: number) => (
                      <div key={v} className="flex gap-1 w-full">
                        <button
                          onClick={() => {
                            if (currentStation.id === 'PACKING') setShrinkRejection(prev => Math.max(0, Number((prev - v).toFixed(2))));
                            else setRejections(prev => ({ ...prev, [currentStation.id]: Math.max(0, prev[currentStation.id] - v) }));
                          }}
                          className="w-1/3 py-6 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-l-2xl font-black text-sm border border-rose-500/10 transition-all active:scale-95"
                        >
                          -
                        </button>
                        <button
                          onClick={() => {
                            if (currentStation.id === 'PACKING') setShrinkRejection(prev => Number((prev + v).toFixed(2)));
                            else setRejections(prev => ({ ...prev, [currentStation.id]: prev[currentStation.id] + v }));
                          }}
                          className="w-2/3 py-6 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-r-2xl font-black text-sm border border-rose-500/10 transition-all active:scale-95"
                        >
                          +{v}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleSaveToOffline('WASTE')}
                    className="w-full mt-6 py-5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Log Waste Only
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sync Footer */}
      <footer className="px-10 py-4 bg-black border-t border-white/5 flex justify-between items-center relative z-20">
        <div className="flex gap-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Telemetry Uplink: Stable</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Encryption: AES-256</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.4em]">ERNAD Intelligent MES v4.0.2</p>
        </div>
      </footer>
    </div>
  );
}
