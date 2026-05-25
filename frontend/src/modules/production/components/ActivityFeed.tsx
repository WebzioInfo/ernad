import React from 'react';
import { Clock, History, Layers, User, Cpu, Activity, AlertTriangle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string | number;
  primaryCount: number;
  wastageCount: number;
  eventType: string;
  secondaryPackagingCount?: number;
  loggedAt: string | Date;
  userName?: string;
  remarks?: string;
  source?: 'OPERATOR' | 'SYSTEM' | 'MACHINE';
  station?: string;
  labelStickerWeight?: string | number;
  damagedLabelWeight?: string | number;
  inkChanged?: boolean;
  inkUsageMl?: string | number;
  makeupChanged?: boolean;
  makeupUsageMl?: string | number;
  shrinkWasteWeight?: string | number;
  sourceBatchNumber?: string;
}

interface ActivityFeedProps {
  history: LogEntry[];
  isLoading?: boolean;
}

const getFriendlyEventName = (eventType: string) => {
  const map: Record<string, string> = {
    NORMAL_PRODUCTION: 'Production Committed',
    BATCH_START: 'Batch Initialized',
    BATCH_END: 'Batch Closed',
    OPERATOR_LOGIN: 'Operator Joined Station',
    OPERATOR_LOGOUT: 'Operator Logged Out',
    MATERIAL_ASSIGNMENT: 'Material Issued',
    POWER_FAILURE: 'Power Outage',
    MACHINE_BREAKDOWN: 'Machine Breakdown',
    LOW_SPEED: 'Low Speed Anomaly',
    MATERIAL_SHORTAGE: 'Material Shortage',
    DOWNTIME_PAUSE: 'Operator Paused Line',
    DOWNTIME_RESOLVED: 'Downtime Cleared',
  };
  return map[eventType] || eventType.replace(/_/g, ' ');
};

const getDotColor = (eventType: string) => {
  if (['NORMAL_PRODUCTION', 'OPERATOR_LOGIN'].includes(eventType)) return 'bg-emerald-500 ring-emerald-100';
  if (['BATCH_START', 'BATCH_END'].includes(eventType)) return 'bg-blue-500 ring-blue-100';
  if (['MATERIAL_ASSIGNMENT'].includes(eventType)) return 'bg-indigo-500 ring-indigo-100';
  if (['OPERATOR_LOGOUT', 'DOWNTIME_RESOLVED'].includes(eventType)) return 'bg-slate-400 ring-slate-100';
  return 'bg-rose-500 ring-rose-100'; // Anomalies
};

const stationStyles: Record<string, string> = {
  BLOWING: 'bg-blue-50 text-blue-700 border-blue-100/60',
  FILLING: 'bg-emerald-50 text-emerald-700 border-emerald-100/60',
  LABELING: 'bg-indigo-50 text-indigo-700 border-indigo-100/60',
  PACKING: 'bg-amber-50 text-amber-700 border-amber-100/60',
  QC: 'bg-rose-50 text-rose-700 border-rose-100/60',
};

const getSourceIcon = (source?: string) => {
  if (source === 'MACHINE') return <Activity size={10} className="text-amber-600" />;
  if (source === 'SYSTEM') return <Cpu size={10} className="text-blue-600" />;
  return <User size={10} className="text-emerald-600" />;
};

const getSourceBadgeClass = (source?: string) => {
  if (source === 'MACHINE') return 'bg-amber-50 text-amber-700 border-amber-150';
  if (source === 'SYSTEM') return 'bg-blue-50 text-blue-700 border-blue-150';
  return 'bg-emerald-50 text-emerald-700 border-emerald-150';
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ history }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-white/90 backdrop-blur-xl sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
            <History size={15} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Uplink Feed</h3>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Real-Time Event Stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100/60">
          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Live Sync</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
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
              const friendlyEvent = getFriendlyEventName(log.eventType);
              const isNormalProd = log.eventType === 'NORMAL_PRODUCTION';
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
                  <div className="absolute left-[7px] top-4 bottom-[-20px] w-[2px] bg-slate-200/80 group-last:bg-transparent" />
                  
                  {/* Glowing Event Dot */}
                  <div className={cn(
                    "absolute left-0 top-[18px] w-4 h-4 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.1)] z-10 transition-transform duration-300 group-hover:scale-125 ring-2",
                    dotColor
                  )} />

                  {/* Glassmorphic Event Card */}
                  <div className="p-5 bg-white border border-slate-200/80 rounded-[18px] hover:border-indigo-300/80 transition-all duration-300 shadow-[0_2px_12px_rgba(15,23,42,0.02)] hover:shadow-[0_8px_20px_rgba(99,102,241,0.05)] hover:-translate-y-0.5">
                    {/* Header: Badges & Time */}
                    <div className="flex justify-between items-center gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Source Tag */}
                        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider", getSourceBadgeClass(log.source))}>
                          {getSourceIcon(log.source)}
                          {log.source || 'OPERATOR'}
                        </div>
                        
                        {/* Station Badge */}
                        {log.station && (
                          <span className={cn("px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider", stationStyles[log.station.toUpperCase()] || 'bg-slate-50 text-slate-650 border-slate-100')}>
                            {log.station}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 tracking-wider uppercase bg-slate-50/80 px-2 py-1 rounded-md border border-slate-100">
                        <Clock size={9} strokeWidth={2.5} />
                        {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="mb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        {friendlyEvent}
                      </h4>
                      
                      {/* Show production count prominently */}
                      {isNormalProd && log.primaryCount > 0 && (
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-900 tracking-tighter">
                            +{log.primaryCount.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Units</span>
                        </div>
                      )}

                      {/* Material usage assignments */}
                      {log.eventType === 'MATERIAL_ASSIGNMENT' && log.primaryCount > 0 && (
                        <div className="mt-2 flex items-baseline gap-1.5 text-indigo-700">
                          <Package size={12} className="self-center" />
                          <span className="text-lg font-black tracking-tight">
                            {log.primaryCount.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider">Assigned</span>
                        </div>
                      )}
                    </div>

                    {/* Technical Parameter Details */}
                    {(log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 || log.wastageCount > 0 || log.labelStickerWeight || log.damagedLabelWeight || log.inkChanged || log.makeupChanged || log.shrinkWasteWeight) && (
                      <div className="grid grid-cols-2 gap-2 py-2.5 px-3 bg-slate-50/70 border border-slate-100 rounded-xl my-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        {log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 && (
                          <div className="flex justify-between border-r border-slate-200/60 pr-2">
                            <span>Secondary:</span>
                            <span className="text-indigo-600 font-extrabold">{log.secondaryPackagingCount}</span>
                          </div>
                        )}
                        {log.wastageCount > 0 && (
                          <div className="flex justify-between pl-2">
                            <span>Rejects:</span>
                            <span className="text-rose-500 font-extrabold">{log.wastageCount}</span>
                          </div>
                        )}
                        {log.labelStickerWeight && (
                          <div className="flex justify-between border-r border-slate-200/60 pr-2">
                            <span>Label Wt:</span>
                            <span className="text-indigo-600 font-extrabold">{log.labelStickerWeight}g</span>
                          </div>
                        )}
                        {log.damagedLabelWeight && (
                          <div className="flex justify-between pl-2">
                            <span>Damage Wt:</span>
                            <span className="text-rose-500 font-extrabold">{log.damagedLabelWeight}g</span>
                          </div>
                        )}
                        {log.inkChanged && (
                          <div className="flex justify-between border-r border-slate-200/60 pr-2 col-span-2">
                            <span>Ink Consumable:</span>
                            <span className="text-emerald-600 font-extrabold">Replaced ({log.inkUsageMl}ml)</span>
                          </div>
                        )}
                        {log.makeupChanged && (
                          <div className="flex justify-between pl-2 col-span-2">
                            <span>Makeup Consumable:</span>
                            <span className="text-emerald-600 font-extrabold">Replaced ({log.makeupUsageMl}ml)</span>
                          </div>
                        )}
                        {log.shrinkWasteWeight && (
                          <div className="flex justify-between col-span-2">
                            <span>Shrink Waste:</span>
                            <span className="text-rose-500 font-extrabold">{log.shrinkWasteWeight}g</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Remarks / Message Bubble */}
                    {log.remarks && (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] font-semibold text-slate-650 italic flex gap-2 items-start leading-relaxed shadow-inner">
                        <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>{log.remarks}</span>
                      </div>
                    )}

                    {/* Operator Footer details */}
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider pt-3 border-t border-slate-100 mt-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User size={10} className="text-slate-400" />
                        <span>{log.userName || 'System'}</span>
                      </div>
                      {log.sourceBatchNumber && (
                        <span className="text-slate-400 font-mono font-bold">Src: {log.sourceBatchNumber}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
