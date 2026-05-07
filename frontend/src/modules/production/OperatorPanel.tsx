import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  PackageOpen, LogOut, Wind, Box,
  Loader2, Zap, ShieldCheck,
  AlertTriangle, Cpu, Save, RefreshCw,
  Construction,
  Sparkles
} from 'lucide-react';
import useAuthStore from '../../modules/auth/auth.store';
import { api } from '../../services/api-client';
import { db } from '../../utils/sync-service';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function OperatorPanel() {
  const { user } = useAuthStore();
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();

  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [line, setLine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [splitValues, setSplitValues] = useState<number[]>([]);
  const [wastageCount, setWastageCount] = useState(0);
  const [eventType, setEventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  const [isRework, setIsRework] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: session, isLoading: isLoadingSession } = useQuery({
    queryKey: ['current-operator-session'],
    queryFn: async () => (await api.get('/operator/session/current')).data,
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.post('/operator/session/end'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      navigate('/line/select');
    }
  });

  // Redirect if no session and not loading
  useEffect(() => {
    if (!isLoadingSession && !session) {
      navigate('/line/select');
    }
  }, [session, isLoadingSession, navigate]);


  const stations = [
    { id: 'BLOWING', title: 'Blowing Station', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', materials: ['Preform Bags'] },
    { id: 'FILLING', title: 'Filling Station', icon: PackageOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', materials: ['Cap Boxes', 'Ozone Status'] },
    { id: 'LABELING', title: 'Labeling Station', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', materials: ['Label Rolls', 'Ink/Ribbon'] },
    { id: 'PACKING', title: 'Packing Station', icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', materials: ['Shrink Rolls', 'Master Cartons'] },
  ];

  const currentStationId = urlStation?.toUpperCase() || session?.station || 'FILLING';
  const currentStation = stations.find(s => s.id === currentStationId) || stations[1];

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

  const addSplitValue = (val: number) => {
    setSplitValues(prev => [...prev, val]);
    setPrimaryCount(prev => prev + val);
  };

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['station-log-history', activeBatch?.id, currentStation.id],
    queryFn: async () => {
      if (!activeBatch?.id) return [];
      return (await api.get(`/telemetry/history/${activeBatch.id}/${currentStation.id}`)).data;
    },
    enabled: !!activeBatch?.id,
  });

  const handleSaveToOffline = async () => {
    if (primaryCount === 0 && wastageCount === 0 && eventType === 'NORMAL_PRODUCTION') {
      return toast.error('Nothing to log');
    }

    const logEntry = {
      requestId: uuidv4(),
      batchId: activeBatch?.id,
      sessionId: session.id,
      lineId: lineId!,
      brandId: activeBatch?.brandId,
      productId: activeBatch?.productId,
      shiftId: session.shiftId || activeBatch?.shiftId || 'SHIFT_A',
      station: currentStation.id,
      primaryCount,
      splitValues,
      wastageCount,
      eventType,
      isRework,
      materials,
      remarks,
      loggedAt: new Date().toISOString(),
      synced: 0
    };

    try {
      await db.offlineLogs.add(logEntry);
      toast.success('Log saved locally (Offline-First)');

      // Sync attempt (optional, background worker usually handles it)
      api.post('/telemetry', logEntry).then(() => {
        refetchHistory();
      }).catch(() => { });

      // Reset state
      setPrimaryCount(0);
      setSplitValues([]);
      setWastageCount(0);
      setIsRework(false);
      setMaterials([]);
      setEventType('NORMAL_PRODUCTION');
      setRemarks('');

    } catch (err) {
      toast.error('Failed to save log locally');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden">
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
              <span className="text-lg font-mono font-black text-white group-hover:text-indigo-200 transition-colors">{activeBatch?.batchCode || '---'}</span>
            </div>
            <div className="group cursor-default">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] block mb-1 group-hover:text-blue-400 transition-colors">Production Brand</span>
              <span className="text-lg font-black text-blue-400 group-hover:text-blue-300 transition-colors">{activeBatch?.brand?.name || '---'}</span>
            </div>
            <div className="group cursor-default">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] block mb-1 group-hover:text-emerald-400 transition-colors">Target Product</span>
              <span className="text-lg font-black text-emerald-400 group-hover:text-emerald-300 transition-colors">{activeBatch?.product?.name || '---'}</span>
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

      <main className="flex-1 p-8 grid grid-cols-12 gap-8 overflow-hidden">
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
            <div className="col-span-8 flex flex-col gap-8 h-full overflow-hidden">
              <div className="bg-white/5 rounded-[3rem] p-10 border border-white/10 flex flex-col items-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Total Real-Time Production Output</p>
                <div className={`text-[12rem] font-black tabular-nums tracking-tighter leading-none mb-8 filter drop-shadow-[0_0_50px_rgba(79,70,229,0.3)] ${currentStation.color}`}>
                  {primaryCount}
                </div>

                {/* Rework Toggle */}
                <div className="flex items-center gap-6 mb-10 px-8 py-3 bg-white/5 rounded-full border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${!isRework ? 'text-white' : 'text-slate-500'}`}>Standard</span>
                    <button
                      onClick={() => setIsRework(!isRework)}
                      className={`w-14 h-7 rounded-full relative transition-all duration-500 ${isRework ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-xl transition-all duration-500 ${isRework ? 'left-8' : 'left-1'}`} />
                    </button>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isRework ? 'text-amber-500' : 'text-slate-500'}`}>Rework Mode</span>
                  </div>
                </div>

                {splitValues.length > 0 && (
                  <div className="flex gap-3 flex-wrap justify-center mb-10 max-h-20 overflow-y-auto custom-scrollbar px-10">
                    {splitValues.map((v, i) => (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={i}
                        className={`px-4 py-1.5 bg-white/5 rounded-full text-xs font-black border border-white/10 ${currentStation.color}`}
                      >
                        +{v}
                      </motion.span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-6 w-full max-w-4xl">
                  {[1000, 500, 100, 50].map(val => (
                    <button
                      key={val}
                      onClick={() => addSplitValue(val)}
                      className={`py-12 ${currentStation.bg.replace('10', '20')} hover:${currentStation.bg.replace('10', '40')} border ${currentStation.border} text-white rounded-[2rem] font-black text-4xl shadow-xl active:scale-95 transition-all group overflow-hidden relative`}
                    >
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative z-10">+{val}</span>
                    </button>
                  ))}
                  {[10, 5, 1, 0.5].map(val => (
                    <button
                      key={val}
                      onClick={() => addSplitValue(val)}
                      className="py-10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-[2rem] font-black text-2xl border border-white/5 active:scale-95 transition-all"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <button
                  onClick={() => { setPrimaryCount(0); setSplitValues([]); }}
                  className="py-6 bg-white/5 rounded-3xl text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-rose-500/10 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20"
                >
                  Clear Entry
                </button>
                <button
                  onClick={handleSaveToOffline}
                  className="col-span-2 py-6 bg-indigo-600 rounded-3xl text-white font-black uppercase tracking-[0.3em] text-sm hover:bg-indigo-500 transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Save className="w-5 h-5" /> Commit Production Log
                </button>
              </div>
            </div>

            {/* Right: History & Events (4 cols) */}
            <div className="col-span-4 flex flex-col gap-8 h-full overflow-hidden">
              {/* Event Selector */}
              <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6">Process Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'NORMAL_PRODUCTION', label: 'Running', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { id: 'DOWNTIME_PAUSE', label: 'Paused', icon: RefreshCw, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { id: 'MACHINE_BREAKDOWN', label: 'Breakdown', icon: Cpu, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                    { id: 'POWER_FAILURE', label: 'Power Cut', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { id: 'MATERIAL_SHORTAGE', label: 'Mat. Low', icon: PackageOpen, color: 'text-blue-400', bg: 'bg-blue-500/10' }
                  ].map(e => (
                    <button
                      key={e.id}
                      onClick={() => setEventType(e.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${eventType === e.id
                        ? `${e.bg} border-white/20 shadow-xl`
                        : 'bg-transparent border-transparent opacity-40 hover:opacity-100 hover:bg-white/5'
                        }`}
                    >
                      <e.icon className={`w-5 h-5 ${e.color}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{e.label}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full mt-6 bg-black/60 border border-white/5 rounded-2xl p-4 text-sm font-bold text-slate-300 focus:outline-none focus:border-indigo-500/50 h-20 resize-none transition-all placeholder:text-slate-700"
                />
              </div>

              {/* Log History */}
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
                      <History className="w-10 h-10 mb-4" />
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

              {/* Material Intake */}
              <div className={`${currentStation.bg} rounded-[2.5rem] p-8 border ${currentStation.border} shadow-xl`}>
                <h3 className={`text-[10px] font-black ${currentStation.color} uppercase tracking-[0.3em] mb-6`}>Material Resource Log</h3>
                <div className="space-y-6">
                  {currentStation.materials?.map(mat => (
                    <div key={mat} className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{mat}</span>
                        <span className={`text-xs font-black ${currentStation.color}`}>{materials.find(m => m.materialName === mat)?.quantity || 0} PCS</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 5, 10].map(v => (
                          <button
                            key={v}
                            onClick={() => {
                              const existing = materials.find(m => m.materialName === mat);
                              if (existing) {
                                setMaterials(materials.map(m => m.materialName === mat ? { ...m, quantity: m.quantity + v } : m));
                              } else {
                                setMaterials([...materials, { materialName: mat, quantity: v, unit: 'PCS' }]);
                              }
                            }}
                            className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black border border-white/5 transition-all active:scale-95"
                          >
                            +{v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wastage */}
              <div className="bg-rose-500/10 rounded-[2.5rem] p-8 border border-rose-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <AlertTriangle className="w-12 h-12 text-rose-500" />
                </div>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-1">Session Rejects</h3>
                    <div className="text-6xl font-black text-rose-500 tabular-nums tracking-tighter leading-none">{wastageCount}</div>
                  </div>
                  <button
                    onClick={() => setWastageCount(0)}
                    className="p-3 bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 rounded-xl transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 10, 50].map(v => (
                    <button
                      key={v}
                      onClick={() => setWastageCount(prev => prev + v)}
                      className="py-4 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-2xl font-black text-sm border border-rose-500/10 transition-all active:scale-95"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>
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
