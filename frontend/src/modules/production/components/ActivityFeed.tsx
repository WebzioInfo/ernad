import React from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import { ProductionLedgerEntry, LedgerLog } from './ProductionLedgerEntry';

interface ActivityFeedProps {
  history: LedgerLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const getDotColor = (eventType: string) => {
  if (['NORMAL_PRODUCTION', 'OPERATOR_LOGIN'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['BATCH_START', 'BATCH_END'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['MATERIAL_ASSIGNMENT'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['OPERATOR_LOGOUT', 'DOWNTIME_RESOLVED'].includes(eventType)) return 'bg-slate-400 ring-slate-100';
  return 'bg-rose-500 ring-rose-100'; // Anomalies
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ history, onRefresh, isRefreshing }) => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 py-5 border-b border-[#1A9A91]/15 flex items-center justify-between bg-white/90 backdrop-blur-xl sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-[10px] bg-[#1A9A91]/5 hover:bg-[#1A9A91]/10 active:scale-95 flex items-center justify-center text-[#1A9A91] border border-[#1A9A91]/15 transition-all disabled:opacity-50"
            title="Refresh Uplink Feed"
          >
            <RefreshCw size={14} className={cn("text-[#1A9A91]", isRefreshing && "animate-spin")} />
          </button>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Uplink Feed</h3>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Real-Time Event Stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A9A91]/5 rounded-full border border-[#1A9A91]/15">
          <span className="text-[9px] font-black text-[#1A9A91] uppercase tracking-wider">Live Sync</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#1A9A91] animate-pulse" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {!history || history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-24 opacity-60">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-350 border border-slate-200/80 mb-4 animate-pulse">
                <Layers size={24} strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Stream Empty</p>
              <p className="text-[9px] font-medium text-slate-450 uppercase tracking-wider mt-2">Waiting for workstation telemetry...</p>
            </div>
          ) : (
            history.map((log, idx) => {
              const dotColor = getDotColor(log.eventType);
              
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 30, delay: Math.min(idx * 0.03, 0.3) }}
                  key={log.id}
                  className="pl-6 relative group"
                >
                  {/* Timeline Connection Line */}
                  <div className="absolute left-[7px] top-3.5 bottom-[-16px] w-[2px] bg-slate-200/80 group-last:bg-transparent" />
                  
                  {/* Glowing Event Dot */}
                  <div className={cn(
                    "absolute left-0 top-[13px] w-4 h-4 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.1)] z-10 transition-transform duration-300 group-hover:scale-125 ring-2",
                    dotColor
                  )} />

                  <ProductionLedgerEntry log={log as LedgerLog} />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
