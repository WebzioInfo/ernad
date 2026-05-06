import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  PackageOpen, LogOut, Wind, Box,
  Loader2, Zap, ShieldCheck,
  AlertTriangle, Cpu, Save, RefreshCw,
  Construction
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { api } from '../../api';
import { db } from '../../utils/sync-service';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function OperatorPanel() {
  const { user } = useAuthStore();
  const { id: lineId } = useParams();

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
    { id: 'BLOWING', title: 'Blowing Station', icon: Wind, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', materials: ['Preform Bags', 'Scrap Bottles'] },
    { id: 'FILLING', title: 'Filling Station', icon: PackageOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', materials: ['Cap Boxes', 'Ozone Status'] },
    { id: 'LABELING', title: 'Labeling Station', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', materials: ['Label Rolls', 'Ink/Ribbon'] },
    { id: 'PACKING', title: 'Packing Station', icon: Box, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', materials: ['Shrink Rolls', 'Master Cartons'] },
  ];

  const currentStationId = session?.station || 'FILLING';
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
    <div className="h-screen flex flex-col bg-slate-900 text-white font-sans overflow-hidden">
      {/* High-Contrast Header */}
      <header className="p-4 border-b border-white/10 flex justify-between items-center bg-black">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <currentStation.icon className={`w-8 h-8 ${currentStation.color}`} />
            <div>
              <h1 className="text-xl font-bold tracking-tight">LINE {line?.name || lineId}</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                {currentStation.title} • Active for {session?.startTime ? formatDistanceToNow(new Date(session.startTime)) : '...'}
              </p>
            </div>
          </div>

        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-4">
            <p className="text-sm font-bold">{user?.name}</p>
            <p className="text-[10px] text-blue-400 uppercase tracking-widest">Operator Session</p>
          </div>
          <button 
            onClick={() => endSessionMutation.mutate()} 
            disabled={endSessionMutation.isPending}
            className="p-3 bg-rose-500/10 rounded-xl hover:bg-rose-500 hover:text-white text-rose-400 transition-all flex items-center gap-2 px-4"
          >
            {endSessionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            <span className="text-[10px] font-black uppercase tracking-widest">End Session</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
        {loading ? (
          <div className="col-span-12 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
        ) : line?.status === 'MAINTENANCE' ? (
          <div className="col-span-12 flex items-center justify-center flex-col text-center">
            <div className="w-24 h-24 bg-rose-500/20 text-rose-500 rounded-[2rem] flex items-center justify-center mb-8">
              <Construction className="w-12 h-12" />
            </div>
            <p className="text-3xl font-black uppercase tracking-tighter">Line Under Maintenance</p>
            <p className="text-slate-500 mt-4 max-w-md font-bold">This production line is currently offline for technical service. Production logging is disabled.</p>
          </div>
        ) : !activeBatch ? (
          <div className="col-span-12 flex items-center justify-center flex-col opacity-50">
            <AlertTriangle className="w-16 h-16 mb-4 text-amber-500" />
            <p className="text-xl font-bold">NO ACTIVE BATCH ON THIS LINE</p>
            <p className="text-sm text-slate-500 mt-2">Please contact a manager to start a production run.</p>
          </div>
        ) : (
          <div className="col-span-12 grid grid-cols-12 gap-6 relative">
            {activeBatch.status === 'CHANGEOVER' && (
              <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center rounded-[3rem]">
                <div className="text-center p-12 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl max-w-lg">
                  <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 animate-pulse">
                    <RefreshCw className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black mb-4 uppercase">Changeover in Progress</h2>
                  <p className="text-slate-400 font-bold leading-relaxed">
                    The line is currently being reconfigured for
                    <span className="text-white block mt-2 text-xl font-black">{activeBatch.product?.name}</span>
                  </p>
                  <div className="mt-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-slate-300">Synchronizing hardware parameters... Please wait.</p>
                  </div>
                </div>
              </div>
            )}
      {/* Context Header */}
      <div className="col-span-12 bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10 mb-2">
        <div className="flex gap-6">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brand</span>
            <span className="text-sm font-bold text-blue-400">{activeBatch?.brand?.name || activeBatch?.brandName || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Product SKU</span>
            <span className="text-sm font-bold text-blue-400">{activeBatch?.product?.name || activeBatch?.productName || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Batch</span>
            <span className="text-sm font-mono text-white">{activeBatch?.batchCode || 'N/A'}</span>
          </div>
        </div>
      </div>

            {/* Main Logging Section */}
            <div className="col-span-8 flex flex-col gap-6">
              <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 flex flex-col items-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total Production (Current Session)</p>
                <div className={`text-9xl font-black tabular-nums tracking-tighter mb-4 ${currentStation.color}`}>{primaryCount}</div>

                {/* Rework Toggle */}
                <div className="flex items-center gap-3 mb-6 px-6 py-2 bg-white/5 rounded-full border border-white/10">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Regular</span>
                  <button
                    onClick={() => setIsRework(!isRework)}
                    className={`w-12 h-6 rounded-full relative transition-all ${isRework ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isRework ? 'left-7' : 'left-1'}`} />
                  </button>
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Rework</span>
                </div>

                {splitValues.length > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center mb-8">
                    {splitValues.map((v, i) => (
                      <span key={i} className={`px-3 py-1 bg-white/10 rounded-full text-xs font-mono ${currentStation.color}`}>+{v}</span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 w-full">
                  {[1000, 500, 100, 50].map(val => (
                    <button
                      key={val}
                      onClick={() => addSplitValue(val)}
                      className={`py-10 ${currentStation.bg.replace('10', '80')} hover:${currentStation.bg.replace('10', '60')} text-white rounded-3xl font-black text-3xl shadow-lg active:scale-95 transition-all border ${currentStation.border}`}
                    >
                      +{val}
                    </button>
                  ))}
                  {[10, 5, 1, 0.5].map(val => (
                    <button
                      key={val}
                      onClick={() => addSplitValue(val)}
                      className="py-8 bg-white/5 hover:bg-white/10 text-white rounded-3xl font-bold text-xl border border-white/10 active:scale-95 transition-all"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setPrimaryCount(0); setSplitValues([]); }}
                  className="py-4 bg-white/5 rounded-2xl text-slate-400 font-bold hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Clear Buffer
                </button>
                <button
                  onClick={handleSaveToOffline}
                  className={`py-4 ${currentStation.bg.replace('10', '80')} rounded-2xl text-white font-bold hover:${currentStation.bg.replace('10', '60')} transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2`}
                >
                  <Save className="w-4 h-4" /> Save Log
                </button>
              </div>
            </div>

            {/* Event & Material Sidebar */}
            <div className="col-span-4 flex flex-col gap-6">
              <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Machine Events</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'NORMAL_PRODUCTION', label: 'Normal', icon: ShieldCheck, color: 'text-emerald-400' },
                    { id: 'MACHINE_BREAKDOWN', label: 'Breakdown', icon: Cpu, color: 'text-rose-400' },
                    { id: 'POWER_FAILURE', label: 'Power Cut', icon: Zap, color: 'text-amber-400' },
                    { id: 'MATERIAL_SHORTAGE', label: 'Material Low', icon: PackageOpen, color: 'text-blue-400' }
                  ].map(e => (
                    <button
                      key={e.id}
                      onClick={() => setEventType(e.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${eventType === e.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <e.icon className={`w-5 h-5 ${e.color}`} />
                        <span className="text-sm font-bold">{e.label}</span>
                      </div>
                      {eventType === e.id && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" />}
                    </button>
                  ))}
                </div>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks or issue details..."
                  className="w-full mt-4 bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500/50 h-24 resize-none"
                />
              </div>

              <div className={`${currentStation.bg} rounded-[2rem] p-6 border ${currentStation.border}`}>
                <h3 className={`text-xs font-bold ${currentStation.color} uppercase tracking-widest mb-4`}>Material Intake</h3>
                <div className="space-y-4">
                  {currentStation.materials?.map(mat => (
                    <div key={mat} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>{mat}</span>
                        <span className={currentStation.color}>{materials.find(m => m.materialName === mat)?.quantity || 0} PCS</span>
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
                            className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold border border-white/10"
                          >
                            +{v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-rose-500/10 rounded-[2rem] p-6 border border-rose-500/20 flex-1">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4">Wastage Count</h3>
                <div className="text-6xl font-black text-rose-500 mb-6">{wastageCount}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 5, 10, 50].map(v => (
                    <button
                      key={v}
                      onClick={() => setWastageCount(prev => prev + v)}
                      className="py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl font-bold border border-rose-500/10 transition-all"
                    >
                      +{v}
                    </button>
                  ))}
                  <button
                    onClick={() => setWastageCount(0)}
                    className="col-span-2 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-bold transition-all text-xs"
                  >
                    Reset Wastage
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sync Footer */}
      <footer className="p-3 bg-black/50 border-t border-white/5 flex justify-between items-center px-8">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Encrypted Secure Session</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 font-bold tracking-tight">PROJECT ERNAD Industrial MES v2.0</p>
      </footer>
    </div>
  );
}
