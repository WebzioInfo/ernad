import React from 'react';
import { Clock, History, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string | number;
  primaryCount: number;
  wastageCount: number;
  eventType: string;
  secondaryPackagingCount?: number;
  loggedAt: string | Date;
}

interface ActivityFeedProps {
  history: LogEntry[];
  isLoading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ history }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-200/60 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[8px] bg-gray-100 flex items-center justify-center text-gray-600">
            <History size={14} strokeWidth={2.5} />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-900">Live Feed</h3>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">Live Sync</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {!history || history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 opacity-40">
              <Layers size={40} className="mb-4 text-gray-300" strokeWidth={1.5} />
              <p className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Stream Empty</p>
            </div>
          ) : (
            history.map((log, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={log.id}
                className="pl-6 relative group"
              >
                {/* Timeline Line & Dot */}
                <div className="absolute left-[7px] top-4 bottom-[-16px] w-[2px] bg-gray-100 group-last:bg-transparent" />
                <div className={cn(
                  "absolute left-0 top-[18px] w-[16px] h-[16px] rounded-full border-[3px] border-white shadow-sm z-10",
                  log.eventType === 'NORMAL_PRODUCTION' ? "bg-emerald-500" : "bg-rose-500"
                )} />

                <div className="p-5 bg-white border border-gray-200/60 rounded-[16px] hover:border-indigo-200 transition-all duration-300 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] font-semibold text-gray-900 tracking-tight">
                        +{log.primaryCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 tracking-wider uppercase bg-gray-50/80 px-2 py-1 rounded-[6px]">
                      <Clock size={10} strokeWidth={2.5} />
                      {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider pt-3 border-t border-gray-100/80 mt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{log.eventType.replace('_', ' ')}</span>
                      {log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 && (
                        <span className="text-indigo-600 border-l border-gray-200/60 pl-3">SEC: {log.secondaryPackagingCount}</span>
                      )}
                    </div>
                    {log.wastageCount > 0 && <span className="text-rose-500">REJ: {log.wastageCount}</span>}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
