import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../modules/auth/auth.store';
import {
  PackageOpen, Clock, LogOut, Wind, Box,
  Loader2, Zap, ShieldCheck,
  RefreshCw, CloudOff, Cloud, Database,
  History
} from 'lucide-react';

import { api } from '../services/api-client';
import { toast } from 'sonner';
import Watermark from './Watermark';
import { db as offlineDb } from '../utils/db'; // Dexie
import { useLiveQuery } from 'dexie-react-hooks';

export default function OperatorPanel() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const { id: lineId } = useParams();

  const [selectedStation, setSelectedStation] = useState<string>('FILLING');
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [wastageCount, setWastageCount] = useState(0);
  const [isRework, setIsRework] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionRuntime, setSessionRuntime] = useState(0);

  // Offline Sync Queue Monitor
  const pendingLogsCount = useLiveQuery(() => offlineDb.offlineLogs.count());

  const stations = [
    { id: 'BLOWING', title: 'Blowing Station', primaryLabel: 'Preforms Processed', wastageLabel: 'Damaged Preforms', icon: Wind, color: 'blue', materials: ['Preform Bags'] },
    { id: 'FILLING', title: 'Filling Station', primaryLabel: 'Bottles Filled', wastageLabel: 'Cap Wastage', icon: PackageOpen, color: 'emerald', materials: ['Cap Boxes'] },
    { id: 'LABELING', title: 'Labeling Station', primaryLabel: 'Units Labeled', wastageLabel: 'Label Wastage', icon: Zap, color: 'indigo', materials: ['Label Rolls'] },
    { id: 'PACKING', title: 'Packing Station', primaryLabel: 'Boxes Packed', wastageLabel: 'Shrink Wastage (Roll)', icon: Box, color: 'amber', materials: ['Shrink Rolls'] },
  ];

  useEffect(() => {
    const fetchActiveBatch = async () => {
      try {
        const res = await api.get(`/production-batch/active/${lineId}`);
        setActiveBatch(res.data);
      } catch (err) {
        console.error('Failed to fetch active batch', err);
      } finally {
        setLoading(false);
      }
    };
    if (lineId) fetchActiveBatch();

    const timer = setInterval(() => setSessionRuntime(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [lineId]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const config = stations.find(s => s.id === selectedStation) || stations[1];
  const Icon = config.icon;

  const handleIncrement = (type: 'primary' | 'wastage', amount: number) => {
    if (type === 'primary') setPrimaryCount(prev => prev + amount);
    else setWastageCount(prev => prev + amount);
  };

  const submitLogs = async () => {
    if (primaryCount === 0 && wastageCount === 0) return toast.warning('Logging buffer is empty');
    setIsSubmitting(true);

    const payload = {
      requestId: crypto.randomUUID(),
      batchId: activeBatch?.id,
      lineId: lineId || '',
      brandId: activeBatch?.brandId || '',
      productId: activeBatch?.productId || '',
      shiftId: activeBatch?.shiftId || 'SHIFT_A',
      station: selectedStation,
      primaryCount,
      splitValues: [primaryCount],
      wastageCount,
      isRework,
      eventType: 'NORMAL_PRODUCTION',
      remarks: '',
      materials: materials,
      loggedAt: new Date().toISOString(),
    };

    try {
      // Save to Offline DB first (Durability)
      await offlineDb.offlineLogs.add({ ...payload, synced: 0 });

      // Attempt immediate sync
      await api.post('/operator-logs', payload);

      // Mark as synced if successful
      await offlineDb.offlineLogs.where('requestId').equals(payload.requestId).modify({ synced: 1 });

      toast.success(`Logged ${primaryCount} units ${isRework ? '(Rework)' : ''}`);
      setPrimaryCount(0);
      setWastageCount(0);
      setIsRework(false);
      setMaterials([]); // Clear materials
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'System error. Data saved locally.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      <Watermark />

      {/* Header */}
      <header className="flex justify-between items-center px-10 py-6 bg-white border-b border-slate-100 z-30 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-slate-900 rounded-2xl shadow-lg">
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Line {lineId}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{config.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-blue-600">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-black tabular-nums tracking-tight">{formatTime(sessionRuntime)}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2">
              {pendingLogsCount && pendingLogsCount > 0 ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{pendingLogsCount} Pending</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Synced</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Station Selection */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {stations.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStation(s.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${selectedStation === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {s.id}
              </button>
            ))}
          </div>

          <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-10 grid grid-cols-12 gap-10 overflow-hidden relative z-10">
        {loading ? (
          <div className="col-span-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : !activeBatch ? (
          <div className="col-span-12 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-200 shadow-xl">
            <PackageOpen className="w-24 h-24 text-slate-100 mb-8" />
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight italic">Waiting for Batch Start</h2>
            <p className="text-slate-400 font-bold max-w-xs text-center mb-10">Production line is currently idle. Contact plant manager to initiate next shift.</p>
            <button onClick={() => window.location.reload()} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200">
              Check System Status
            </button>
          </div>
        ) : (
          <>
            {/* Control Panel */}
            <div className="col-span-8 flex flex-col gap-8">
              <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl shadow-slate-200/40 relative overflow-hidden">
                <div className="flex justify-between items-start mb-10 relative z-10">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">Live Recording</span>
                      {isRework && <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100 flex items-center gap-1.5"><History className="w-3 h-3" /> Rework Mode</span>}
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none italic">Units Processed</h2>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsRework(!isRework)}
                      className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${isRework ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                        }`}
                    >
                      Rework Toggle
                    </button>
                  </div>
                </div>

                <div className={`rounded-[3rem] p-16 text-center transition-all duration-500 relative group ${isRework ? 'bg-amber-900 shadow-amber-900/40' : 'bg-slate-900 shadow-slate-900/40'}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-6 opacity-40 text-white">{config.primaryLabel}</p>
                    <div className="text-9xl font-black text-white tabular-nums tracking-tighter transition-transform group-hover:scale-110">{primaryCount}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-5 mt-10 relative z-10">
                  {[1, 10, 50, 100].map(val => (
                    <button
                      key={val}
                      onClick={() => handleIncrement('primary', val)}
                      className={`py-8 rounded-[2.5rem] text-3xl font-black transition-all border-2 active:scale-95 ${val === 100 ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-200' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-900'
                        }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => setPrimaryCount(0)} className="py-5 bg-white text-slate-400 font-black rounded-2xl border border-slate-100 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-3">
                  <RefreshCw className="w-5 h-5" /> Clear Buffer
                </button>
                <button
                  onClick={submitLogs}
                  disabled={isSubmitting || (primaryCount === 0 && wastageCount === 0)}
                  className="py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5 text-blue-400" /> Push to Factory Core</>}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20">
              <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-6">Material Intake</h3>
              <div className="space-y-4">
                {config.materials.map(mat => (
                  <div key={mat} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{mat}</span>
                      <span className="text-sm font-black text-slate-900 tracking-tight">
                        {materials.find(m => m.name === mat)?.quantity || 0} Units
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 5, 10].map(v => (
                        <button
                          key={v}
                          onClick={() => {
                            const existing = materials.find(m => m.name === mat);
                            if (existing) {
                              setMaterials(materials.map(m => m.name === mat ? { ...m, quantity: m.quantity + v } : m));
                            } else {
                              setMaterials([...materials, { name: mat, quantity: v, unit: 'PCS' }]);
                            }
                          }}
                          className="py-2 bg-white text-[10px] font-black rounded-lg border border-slate-100 hover:border-blue-200 transition-all"
                        >
                          +{v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20 flex flex-col">
              <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6">Wastage Module</h3>
              <div className="bg-rose-50 rounded-3xl p-8 text-center border border-rose-100 mb-8 flex-1 flex flex-col justify-center">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">{config.wastageLabel}</p>
                <div className="text-7xl font-black text-rose-600 tabular-nums">{wastageCount}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 5].map(v => (
                  <button key={v} onClick={() => handleIncrement('wastage', v)} className="py-4 bg-white text-slate-900 font-black rounded-xl border border-slate-100 hover:border-rose-200 transition-all">+{v}</button>
                ))}
                <button onClick={() => handleIncrement('wastage', 10)} className="col-span-2 py-4 bg-rose-500 text-white font-black rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all tracking-tight uppercase text-[10px]">Add +10 Waste</button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="px-10 py-4 bg-white border-t border-slate-100 flex justify-between items-center z-20">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enterprise Ledger v1.2</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure Handshake Active</span>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter italic">Product of Webzio International</span>
        </div>
      </footer>
    </div>
  );
}
