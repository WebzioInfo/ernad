import React from 'react';
import { Clock, Layers, User, Cpu, Activity, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string | number;
  primaryCount: number;
  wastageCount: number | string;
  eventType: string;
  secondaryPackagingCount?: number;
  loggedAt: string | Date;
  userName?: string;
  remarks?: string;
  source?: 'OPERATOR' | 'SYSTEM' | 'MACHINE';
  station?: string;
  labelStickerWeight?: string | number;
  damagedLabelWeight?: string | number;
  bopRollUsage?: string | number;
  inkChanged?: boolean;
  inkUsageMl?: string | number;
  makeupChanged?: boolean;
  makeupUsageMl?: string | number;
  shrinkWasteWeight?: string | number;
  sourceBatchNumber?: string;
  rawMaterialId?: string;
  rawMaterialName?: string;
  bagsUsed?: number | string;
  capBoxUsage?: number | string;
  capUsage?: number | string;
  preformUsage?: number | string;
  bottleLeakage?: number | string;
  capWastage?: number | string;
}

interface ActivityFeedProps {
  history: LogEntry[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
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
  if (['NORMAL_PRODUCTION', 'OPERATOR_LOGIN'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['BATCH_START', 'BATCH_END'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['MATERIAL_ASSIGNMENT'].includes(eventType)) return 'bg-[#1A9A91] ring-[#1A9A91]/15';
  if (['OPERATOR_LOGOUT', 'DOWNTIME_RESOLVED'].includes(eventType)) return 'bg-slate-400 ring-slate-100';
  return 'bg-rose-500 ring-rose-100'; // Anomalies
};

const stationStyles: Record<string, string> = {
  BLOWING: 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20',
  FILLING: 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20',
  LABELING: 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20',
  PACKING: 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20',
  QC: 'bg-rose-50 text-rose-700 border-rose-100/60',
};

const getSourceIcon = (source?: string) => {
  if (source === 'MACHINE') return <Activity size={10} className="text-[#1A9A91]" />;
  if (source === 'SYSTEM') return <Cpu size={10} className="text-[#1A9A91]" />;
  return <User size={10} className="text-[#1A9A91]" />;
};

const getSourceBadgeClass = (source?: string) => {
  if (source === 'MACHINE') return 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20';
  if (source === 'SYSTEM') return 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20';
  return 'bg-[#1A9A91]/5 text-[#1A9A91] border-[#1A9A91]/20';
};

const formatWastageValue = (value: string | number) => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
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
                  <div className="absolute left-[7px] top-3.5 bottom-[-16px] w-[2px] bg-slate-200/80 group-last:bg-transparent" />
                  
                  {/* Glowing Event Dot */}
                  <div className={cn(
                    "absolute left-0 top-[13px] w-4 h-4 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.1)] z-10 transition-transform duration-300 group-hover:scale-125 ring-2",
                    dotColor
                  )} />

                  {/* Glassmorphic Event Card */}
                  <div className="p-2.5 bg-white border border-[#1A9A91]/15 rounded-[12px] hover:border-[#1A9A91]/35 transition-all duration-300 shadow-[0_2px_12px_rgba(15,23,42,0.02)] hover:shadow-[0_8px_20px_rgba(26,154,145,0.06)] hover:-translate-y-0.5">
                    {/* Header: Badges & Time */}
                    <div className="flex justify-between items-center gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Source Tag */}
                        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider", getSourceBadgeClass(log.source))}>
                          {getSourceIcon(log.source)}
                          {log.source || 'OPERATOR'}
                        </div>
                        
                        {/* Station Badge */}
                        {log.station && (
                          <span className={cn("px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider", stationStyles[log.station.toUpperCase()] || 'bg-slate-50 text-slate-650 border-slate-100')}>
                            {log.station}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 tracking-wider uppercase bg-slate-50/80 px-2 py-0.5 rounded-md border border-slate-100">
                        <Clock size={9} strokeWidth={2.5} />
                        {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="mb-1">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        {friendlyEvent}
                      </h4>
                      
                      {/* Show production count prominently */}
                      {isNormalProd && log.primaryCount > 0 && (
                        <div className="mt-0.5 flex items-baseline gap-1.5">
                          <span className="text-base font-black text-slate-900 tracking-tighter">
                            +{log.primaryCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Units</span>
                        </div>
                      )}

                      {/* Material usage assignments */}
                      {log.eventType === 'MATERIAL_ASSIGNMENT' && log.primaryCount > 0 && (
                        <div className="mt-0.5 flex items-baseline gap-1.5 text-[#1A9A91]">
                          <Package size={12} className="self-center" />
                          <span className="text-sm font-black tracking-tight">
                            {log.primaryCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Assigned</span>
                        </div>
                      )}
                    </div>

                    {/* Technical Parameter Details */}
                    {(log.station === 'LABELING' || log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 || (Number(log.wastageCount) || 0) > 0 || log.labelStickerWeight || log.damagedLabelWeight || log.inkChanged || log.makeupChanged || log.bagsUsed || log.capBoxUsage || log.capUsage || log.preformUsage || log.rawMaterialName) && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 py-1 px-2 bg-slate-50/70 border border-slate-100 rounded-lg my-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {log.rawMaterialName && (
                          <div className="flex justify-between col-span-2 border-b border-slate-200/60 pb-0.5 mb-0.5">
                            <span>Raw Material:</span>
                            <span className="text-[#1A9A91] font-black truncate max-w-[165px]">{log.rawMaterialName}</span>
                          </div>
                        )}
                        {log.bagsUsed !== undefined && Number(log.bagsUsed) > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span>Bags Used:</span>
                              <span className="text-[#1A9A91] font-black">{log.bagsUsed}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Bags Weight:</span>
                              <span className="text-[#1A9A91] font-black">{Number(log.bagsUsed) * 25} KG</span>
                            </div>
                          </>
                        )}
                        {log.capUsage !== undefined && Number(log.capUsage) > 0 && (
                          <div className="flex justify-between">
                            <span>Caps Used:</span>
                            <span className="text-[#1A9A91] font-black">{log.capUsage}</span>
                          </div>
                        )}
                        {log.preformUsage !== undefined && Number(log.preformUsage) > 0 && (
                          <div className="flex justify-between">
                            <span>Preforms Used:</span>
                            <span className="text-[#1A9A91] font-black">{log.preformUsage}</span>
                          </div>
                        )}
                        {log.capBoxUsage !== undefined && Number(log.capBoxUsage) > 0 && (
                          <div className="flex justify-between">
                            <span>Cap Boxes:</span>
                            <span className="text-[#1A9A91] font-black">{log.capBoxUsage}</span>
                          </div>
                        )}
                        {log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 && (
                          <div className="flex justify-between">
                            <span>Secondary:</span>
                            <span className="text-[#1A9A91] font-black">{log.secondaryPackagingCount}</span>
                          </div>
                        )}
                        {log.station === 'FILLING' && (Number(log.bottleLeakage) > 0 || Number(log.capWastage) > 0) ? (
                          <>
                            {Number(log.bottleLeakage) > 0 && (
                              <div className="flex justify-between">
                                <span>Bottle Leakage:</span>
                                <span className="text-rose-500 font-black">{log.bottleLeakage}</span>
                              </div>
                            )}
                            {Number(log.capWastage) > 0 && (
                              <div className="flex justify-between">
                                <span>Cap Wastage:</span>
                                <span className="text-rose-500 font-black">{log.capWastage}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          (Number(log.wastageCount) || 0) > 0 && (
                            <div className="flex justify-between">
                              <span>
                                {log.station === 'BLOWING'
                                  ? 'Preform Rejects:'
                                  : log.station === 'FILLING'
                                  ? 'Cap Rejects:'
                                  : log.station === 'LABELING'
                                  ? 'Label Rejects:'
                                  : log.station === 'PACKING'
                                  ? 'Shrink Reject:'
                                  : 'Rejects:'}
                              </span>
                               <span className="text-rose-500 font-black">
                                {log.station === 'LABELING'
                                  ? `${formatWastageValue(log.wastageCount)} KG`
                                  : log.station === 'PACKING'
                                  ? `${formatWastageValue(log.wastageCount)}g`
                                  : formatWastageValue(log.wastageCount)}
                              </span>
                            </div>
                          )
                        )}
                        {log.station === 'LABELING' && (log.bopRollUsage !== undefined || log.labelStickerWeight !== undefined) && (
                          <div className="flex justify-between">
                            <span>Label Used:</span>
                            <span className="text-[#1A9A91] font-black">{log.bopRollUsage || log.labelStickerWeight} KG</span>
                          </div>
                        )}
                        {log.station !== 'LABELING' && log.labelStickerWeight && (
                          <div className="flex justify-between">
                            <span>Label Wt:</span>
                            <span className="text-[#1A9A91] font-black">{log.labelStickerWeight}g</span>
                          </div>
                        )}
                        {log.station !== 'LABELING' && log.damagedLabelWeight && (
                          <div className="flex justify-between">
                            <span>Damage Wt:</span>
                            <span className="text-rose-500 font-black">{log.damagedLabelWeight}g</span>
                          </div>
                        )}
                        {log.station === 'LABELING' && (
                          <div className="flex justify-between col-span-2">
                            <span>Ink Used:</span>
                            <span className={cn('font-black', log.inkChanged ? 'text-[#1A9A91]' : 'text-slate-400')}>
                              {log.inkChanged ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}
                        {log.station === 'LABELING' && (
                          <div className="flex justify-between col-span-2">
                            <span>Makeup Used:</span>
                            <span className={cn('font-black', log.makeupChanged ? 'text-[#1A9A91]' : 'text-slate-400')}>
                              {log.makeupChanged ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Remarks / Message Bubble */}
                    {log.remarks && (
                      <div className="mt-1.5 p-2 rounded-lg bg-[#1A9A91]/5 border border-[#1A9A91]/10 text-[10px] font-semibold text-slate-650 italic flex gap-2 items-start leading-relaxed shadow-inner">
                        <AlertTriangle size={12} className="text-[#1A9A91] shrink-0 mt-0.5" />
                        <span>{log.remarks}</span>
                      </div>
                    )}

                    {/* Operator Footer details */}
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider pt-1.5 border-t border-slate-100 mt-1.5">
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
