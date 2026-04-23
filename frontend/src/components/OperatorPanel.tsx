import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { 
  PackageOpen, Clock, LogOut, Wind, Box, 
  Loader2, Zap, ShieldCheck, User,
  RefreshCw
} from 'lucide-react';

import { api } from '../api';
import toast from 'react-hot-toast';
import Watermark from './Watermark';

export default function OperatorPanel() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { id: lineId } = useParams();

  const [selectedStation, setSelectedStation] = useState<string>('FILLING');
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [wastageCount, setWastageCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionRuntime, setSessionRuntime] = useState(0);

  const stations = [
    { id: 'BLOWING', title: 'Blowing Station', primaryLabel: 'Preforms Processed', wastageLabel: 'Damaged Preforms', icon: Wind, endpoint: '/logs/blowing', apiCountField: 'preformCount', apiWastageField: 'damaged', color: 'blue' },
    { id: 'FILLING', title: 'Filling Station', primaryLabel: 'Bottles Filled', wastageLabel: 'Cap Wastage', icon: PackageOpen, endpoint: '/logs/filling', apiCountField: 'bottleCount', apiWastageField: 'capWastage', color: 'emerald' },
    { id: 'LABELING', title: 'Labeling Station', primaryLabel: 'Units Labeled', wastageLabel: 'Label Wastage', icon: Zap, endpoint: '/logs/labeling', apiCountField: 'labeledCount', apiWastageField: 'labelWastage', color: 'indigo' },
    { id: 'PACKING', title: 'Packing Station', primaryLabel: 'Boxes Packed', wastageLabel: 'Shrink Wastage (Roll)', icon: Box, endpoint: '/logs/packing', apiCountField: 'packedCount', apiWastageField: 'shrinkWastageKg', color: 'amber' },
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
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getOperatorDetails = () => {
    if (user?.role === 'SUPER_ADMIN') {
      return stations.find(s => s.id === selectedStation) || stations[1];
    }
    switch (user?.role) {
      case 'BLOWING_OPERATOR':
        return stations[0];
      case 'FILLING_OPERATOR':
        return stations[1];
      case 'LABELING_OPERATOR':
        return stations[2];
      case 'PACKING_OPERATOR':
        return stations[3];
      default:
        return { title: 'Operator Station', primaryLabel: 'Units Processed', wastageLabel: 'Wastage', icon: Zap, endpoint: '/logs/generic', apiCountField: 'count', apiWastageField: 'wastage', color: 'indigo' };
    }
  };

  const config = getOperatorDetails();
  const Icon = config.icon;



  const handleIncrement = (type: 'primary' | 'wastage', amount: number) => {
    if (type === 'primary') setPrimaryCount(prev => prev + amount);
    else setWastageCount(prev => prev + amount);
  };

  const submitLogs = async () => {
    if (primaryCount === 0 && wastageCount === 0) return toast.error('Logging buffer is empty');
    setIsSubmitting(true);
    try {
      await api.post(config.endpoint, {
        userId: user?.id,
        [config.apiCountField]: primaryCount,
        [config.apiWastageField]: wastageCount,
        batchId: activeBatch?.id
      });
      toast.success(`Successfully Saved ${primaryCount} units to factory core.`);
      setPrimaryCount(0);
      setWastageCount(0);
    } catch (err: any) {
      toast.error('Sync failure: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans relative overflow-hidden">
      <Watermark />
      
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-5 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 sticky top-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-10 bg-slate-900 rounded-full" />
             <div className={`p-3 bg-slate-900 rounded-[1.25rem] shadow-xl shadow-slate-900/20`}>
               <Icon className={`w-6 h-6 text-white`} />
             </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Line {lineId}</h1>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{config.title}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black tabular-nums">{formatTime(sessionRuntime)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase">Live Syncing</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-[1.5rem] border border-slate-200 shadow-inner">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Station:</span>
              <select 
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer appearance-none pr-4"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

           <div className="flex items-center gap-4 pl-6 border-l border-slate-100">
              <div className="text-right">
                <p className="text-slate-900 font-black text-sm tracking-tight">{user?.name}</p>
                <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner ring-4 ring-white">
                {(user as any)?.avatarUrl ? (
                  <img src={(user as any).avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User className="w-6 h-6" />
                  </div>
                )}
              </div>
           </div>

           <button onClick={handleLogout} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl border border-transparent hover:border-rose-100 transition-all active:scale-95">
             <LogOut className="w-5 h-5" />
           </button>
        </div>
      </header>


      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 overflow-hidden">
        {loading ? (
          <div className="lg:col-span-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Connecting to system...</p>
          </div>
        ) : !activeBatch ? (
          <div className="lg:col-span-12 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 p-20">
            <PackageOpen className="w-20 h-20 text-slate-200 mb-6" />
            <h2 className="text-2xl font-bold text-slate-400 mb-2">No Active Batch</h2>
            <p className="text-slate-500 text-center max-w-sm mb-8">Waiting for manager to start the production line.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold border border-slate-200 transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh Status
            </button>
          </div>
        ) : (
          <>
            {/* Left: Station Controls */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl shadow-slate-200/40 relative overflow-hidden">
                 <div className="absolute -top-10 -right-10 p-12 opacity-[0.03]">
                    <Icon className="w-64 h-64 text-slate-900" />
                 </div>
                 
                 <div className="flex justify-between items-end mb-10 relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active Recording Session</span>
                      </div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Production Output</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Current Batch</p>
                      <div className="px-4 py-1.5 bg-slate-900 rounded-xl">
                        <p className="text-white font-mono font-black text-sm tracking-tighter italic">#{activeBatch?.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                 </div>

                 <div className="bg-slate-900 rounded-[3rem] p-12 text-center shadow-2xl shadow-slate-900/40 mb-10 relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-50" />
                    <div className="relative z-10">
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 opacity-60">{config.primaryLabel}</div>
                      <div className="text-8xl font-black text-white tabular-nums tracking-tighter group-hover:scale-105 transition-transform duration-500">{primaryCount}</div>
                      <div className="mt-6 flex justify-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-blue-500" />
                         <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                         <div className="w-1 h-1 rounded-full bg-blue-500/20" />
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4 relative z-10">
                    {[1, 10, 50, 100].map(val => (
                       <button 
                        key={val}
                        onClick={() => handleIncrement('primary', val)}
                        className={`py-6 rounded-[2rem] font-black text-2xl transition-all duration-300 border-2 active:scale-95 ${
                          val === 100 
                          ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/40 hover:bg-blue-700 hover:shadow-blue-600/60' 
                          : 'bg-white text-slate-900 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 shadow-sm'
                        }`}
                       >
                         +{val}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setPrimaryCount(0)}
                  className="py-4 bg-white rounded-[1.5rem] border border-slate-200 text-slate-400 font-bold text-xs   hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Count

                </button>
                <button 
                  onClick={submitLogs}
                  disabled={isSubmitting || (primaryCount === 0 && wastageCount === 0)}
                  className="py-4 bg-slate-900 text-white rounded-[1.5rem] font-bold text-xs   hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-slate-900/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 text-blue-400" /> Sync with System</>}

                </button>
              </div>

            </div>

            {/* Right: Info & Wastage */}
            <div className="lg:col-span-4 flex flex-col gap-6 h-full">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/20">
                   <h3 className="text-xs font-bold text-slate-400   mb-6">Production Batch</h3>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">Current Product</span>
                         <span className="text-xs font-bold text-slate-800 tracking-tight">{activeBatch?.product?.name || 'Purified Water 2L'}</span>

                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">Brand Name</span>
                         <span className="text-xs font-bold text-slate-800 tracking-tight">{activeBatch?.brand?.name || 'Ernad Premium'}</span>


                      </div>
                   </div>
                </div>

                <div className="flex-1 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/20 flex flex-col min-h-0">
                   <h3 className="text-xs font-bold text-rose-500   mb-6">Record Wastage</h3>

                   
                   <div className="bg-rose-50 rounded-2xl p-6 text-center border border-rose-100 mb-6 flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-bold text-rose-400   mb-1">{config.wastageLabel}</div>
                      <div className="text-6xl font-bold text-rose-600 tabular-nums tracking-tight">{wastageCount}</div>

                   </div>

                   <div className="grid grid-cols-2 gap-3 mt-auto">
                      {[1, 5].map(val => (
                        <button 
                          key={val}
                          onClick={() => handleIncrement('wastage', val)}
                          className="py-4 bg-white hover:bg-rose-50 text-slate-900 font-bold text-lg rounded-xl border border-slate-100 hover:border-rose-200 transition-all"

                        >
                          +{val}
                        </button>
                      ))}
                      <button 
                        onClick={() => handleIncrement('wastage', 10)}
                        className="col-span-2 py-4 bg-rose-500 text-white font-bold text-xs   rounded-xl shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all"
                      >
                        Add +10 Wasted Units

                      </button>
                   </div>
                </div>
            </div>

          </>
        )}
      </main>

      <footer className="px-8 py-3 bg-white border-t border-slate-200 flex justify-between items-center z-20">
         <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span>Online</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
               <span>Synced</span>
            </div>
         </div>
         <div className="text-right">
            <p className="text-xs text-slate-300">A Webzio International Product & Service</p>
            <p className="text-xs font-bold text-slate-400 tracking-tight">Built by Webzio Technology</p>
         </div>

      </footer>
    </div>
  );
}

