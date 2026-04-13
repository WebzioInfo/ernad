import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { PackageOpen, AlertTriangle, CheckCircle, Clock, LogOut, Wind, Box } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function OperatorPanel() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [activeBatch, setActiveBatch] = useState<boolean>(true); // Assume batch active for demo
  const [primaryCount, setPrimaryCount] = useState(0);
  const [wastageCount, setWastageCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getOperatorDetails = () => {
    switch (user?.role) {
      case 'BLOWING_OPERATOR':
        return { title: 'Blowing Station', primaryLabel: 'Preforms Processed', wastageLabel: 'Damaged Preforms', icon: Wind, endpoint: '/logs/blowing', apiCountField: 'preformCount', apiWastageField: 'damaged' };
      case 'FILLING_OPERATOR':
        return { title: 'Filling Station', primaryLabel: 'Bottles Filled', wastageLabel: 'Cap Wastage', icon: PackageOpen, endpoint: '/logs/filling', apiCountField: 'bottleCount', apiWastageField: 'capWastage' };
      case 'PACKING_OPERATOR':
        return { title: 'Packing Station', primaryLabel: 'Boxes Packed', wastageLabel: 'Shrink Wastage (Roll)', icon: Box, endpoint: '/logs/packing', apiCountField: 'packedCount', apiWastageField: 'shrinkWastageKg' };
      default:
        // Generic fallback
        return { title: 'Operator Station', primaryLabel: 'Units Processed', wastageLabel: 'Wastage', icon: PackageOpen, endpoint: '/logs/generic', apiCountField: 'count', apiWastageField: 'wastage' };
    }
  };

  const config = getOperatorDetails();
  const Icon = config.icon;

  const handleIncrement = (type: 'primary' | 'wastage', amount: number) => {
    if (type === 'primary') {
      setPrimaryCount(prev => prev + amount);
    } else {
      setWastageCount(prev => prev + amount);
    }
  };

  const submitLogs = async () => {
    if (primaryCount === 0 && wastageCount === 0) return toast.error('Nothing to submit');
    setIsSubmitting(true);
    
    try {
      // Mock Drizzle insert via NestJS
      await api.post(config.endpoint, {
        operatorId: user?.id,
        [config.apiCountField]: primaryCount,
        [config.apiWastageField]: wastageCount,
        batchId: 'c2f35d21-f0bd-437a-ab18-8f533ee9b41a' // MOCK static batch 
      });
      toast.success(`${primaryCount} ${config.primaryLabel} logged!`);
      setPrimaryCount(0);
      setWastageCount(0);
    } catch (err: any) {
      toast.error('Failed to submit: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="flex justify-between items-center px-6 py-4 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 shadow-lg shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
            <Icon className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Line 1 - {config.title}</h1>
            <p className="text-slate-400 text-sm font-medium flex items-center mt-1">
              <Clock className="w-4 h-4 mr-1.5" /> Shift 1 • Opr: {user?.name || 'Unknown'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {activeBatch ? (
            <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
               <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
               <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">Batch #1042 Running</span>
            </div>
          ) : (
             <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-full">
               <AlertTriangle className="w-5 h-5 text-rose-500" />
               <span className="text-rose-400 font-bold uppercase tracking-wider text-sm">No Active Batch</span>
            </div>
          )}
          <button type="button" onClick={handleLogout} className="bg-slate-700 hover:bg-rose-900/40 hover:text-rose-400 p-2.5 rounded-full border border-slate-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {!activeBatch ? (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/30 backdrop-blur-sm">
            <PackageOpen className="w-20 h-20 text-slate-600 mb-6" />
            <p className="text-2xl text-slate-400 font-medium mb-8 text-center max-w-md">Waiting for Supervisor to initiate production batch...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* PRODUCTION LOGGING */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 flex flex-col shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-8 z-10">
                <h2 className="text-2xl font-bold text-slate-200">Log Production</h2>
                <div className="bg-slate-900 rounded-xl px-4 py-2 border border-slate-700 font-mono text-sm text-slate-400">{config.primaryLabel}</div>
              </div>
              
              <div className="bg-slate-900/50 rounded-2xl p-6 text-center mb-8 border border-slate-800/80 z-10 shadow-inner">
                <div className="text-7xl font-black text-white tracking-tight drop-shadow-md tabular-nums">{primaryCount}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6 mt-auto z-10">
                <button type="button" disabled={isSubmitting} className="bg-slate-700 hover:bg-slate-600 active:bg-blue-600 disabled:opacity-50 text-white font-bold py-6 rounded-2xl text-2xl transition-colors shadow-md border border-slate-600/50" onClick={() => handleIncrement('primary', 1)}>+ 1</button>
                <button type="button" disabled={isSubmitting} className="bg-slate-700 hover:bg-slate-600 active:bg-blue-600 disabled:opacity-50 text-white font-bold py-6 rounded-2xl text-2xl transition-colors shadow-md border border-slate-600/50" onClick={() => handleIncrement('primary', 10)}>+ 10</button>
                <button type="button" disabled={isSubmitting} className="bg-slate-700 hover:bg-slate-600 active:bg-blue-600 disabled:opacity-50 text-white font-bold py-6 rounded-2xl text-2xl transition-colors shadow-md border border-slate-600/50" onClick={() => handleIncrement('primary', 50)}>+ 50</button>
                <button type="button" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-black py-6 rounded-2xl text-3xl transition-transform shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-500" onClick={() => handleIncrement('primary', 100)}>+ 100</button>
              </div>
              
              <button disabled={isSubmitting} onClick={submitLogs} className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-wait text-emerald-400 border border-emerald-500/30 font-bold py-4 rounded-xl text-lg transition-colors flex justify-center items-center gap-2 z-10 mt-2">
                <CheckCircle className="w-6 h-6" />
                {isSubmitting ? 'Syncing...' : 'Submit to Database'}
              </button>
            </div>

            {/* WASTAGE LOGGING */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-8 flex flex-col shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

              <div className="flex justify-between items-start mb-8 z-10">
                <h2 className="text-2xl font-bold text-slate-200">Log Wastage</h2>
                 <div className="bg-slate-900 rounded-xl px-4 py-2 border border-slate-700 font-mono text-sm text-slate-400">{config.wastageLabel}</div>
              </div>
              
              <div className="bg-rose-950/20 rounded-2xl p-6 text-center mb-8 border border-rose-900/40 z-10 shadow-inner">
                <div className="text-7xl font-black text-rose-500 tracking-tight drop-shadow-md tabular-nums">{wastageCount}</div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6 mt-auto z-10">
                <button type="button" disabled={isSubmitting} className="bg-slate-700 hover:bg-rose-900/60 active:bg-rose-600 disabled:opacity-50 text-rose-200 font-bold py-6 rounded-2xl text-xl transition-colors shadow-md border border-slate-600/50" onClick={() => handleIncrement('wastage', 1)}>+ 1</button>
                <button type="button" disabled={isSubmitting} className="bg-slate-700 hover:bg-rose-900/60 active:bg-rose-600 disabled:opacity-50 text-rose-200 font-bold py-6 rounded-2xl text-xl transition-colors shadow-md border border-slate-600/50" onClick={() => handleIncrement('wastage', 5)}>+ 5</button>
                <button type="button" disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 text-white font-black py-6 rounded-2xl text-2xl transition-transform shadow-[0_0_20px_rgba(225,29,72,0.4)] border border-rose-500" onClick={() => handleIncrement('wastage', 10)}>+ 10</button>
              </div>

               <button disabled={isSubmitting} onClick={submitLogs} className="w-full bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-400 border border-rose-500/30 font-bold py-4 rounded-xl text-lg transition-colors flex justify-center items-center gap-2 z-10 mt-2">
                <CheckCircle className="w-6 h-6" />
                Submit Wastage
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
