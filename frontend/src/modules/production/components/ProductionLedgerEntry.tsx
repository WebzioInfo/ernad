import React from 'react';
import { Package, AlertTriangle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LedgerLog {
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
  makeupChanged?: boolean;
  inkUsage?: string | number;
  solventUsage?: string | number;
  shrinkWasteWeight?: string | number;
  shrinkWeightUsed?: string | number;
  sourceBatchNumber?: string;
  rawMaterialId?: string;
  rawMaterialName?: string;
  bagsUsed?: number | string;
  capBoxUsage?: number | string;
  capUsage?: number | string;
  preformUsage?: number | string;
  bottleLeakage?: number | string;
  selectedShrinks?: Array<{ shrinkId: string; shrinkName: string; mmUsed: number; wastageKg?: number }>;
  shrinkWastageKg?: string | number;
  glueUsageKg?: string | number;
  rollsUsed?: string | number;
  lineName?: string;
  line?: { name: string };
}

interface ProductionLedgerEntryProps {
  log: LedgerLog;
  variant?: 'feed' | 'table' | 'compact';
}

const formatWastageValue = (value: string | number) => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};

export const ProductionLedgerEntry: React.FC<ProductionLedgerEntryProps> = ({ log, variant = 'feed' }) => {
  const isNormalProd = log.eventType === 'NORMAL_PRODUCTION';
  const isAnomaly = !['NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'OPERATOR_LOGIN', 'OPERATOR_LOGOUT', 'MATERIAL_ASSIGNMENT', 'DOWNTIME_RESOLVED'].includes(log.eventType);

  // Station specific rendering logic
  const renderStationFields = () => {
    const station = log.station?.toUpperCase();
    
    // Ensure all fields are numbers for logic checks
    const hasRejects = (Number(log.wastageCount) || 0) > 0;

    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-1.5 px-2 bg-slate-50/70 border border-slate-100 rounded-lg mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        
        {/* === BLOWING STATION === */}
        {station === 'BLOWING' && (
          <>
            {log.rawMaterialName && (
              <div className="flex justify-between col-span-2 border-b border-slate-200/60 pb-0.5 mb-0.5">
                <span>Raw Material:</span>
                <span className="text-[#1A9A91] font-black truncate max-w-[165px]">{log.rawMaterialName}</span>
              </div>
            )}
            {hasRejects && (
              <div className="flex justify-between col-span-2">
                <span>Rejects:</span>
                <span className="text-rose-500 font-black">{formatWastageValue(log.wastageCount)} UNITS</span>
              </div>
            )}
            {log.bagsUsed !== undefined && Number(log.bagsUsed) > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Bags Used:</span>
                <span className="text-[#1A9A91] font-black">{log.bagsUsed}</span>
              </div>
            )}
          </>
        )}

        {/* === FILLING STATION === */}
        {station === 'FILLING' && (
          <>
            {hasRejects && (
              <div className="flex justify-between col-span-2">
                <span>Rejects:</span>
                <span className="text-rose-500 font-black">{formatWastageValue(log.wastageCount)} UNITS</span>
              </div>
            )}
            {log.capUsage !== undefined && Number(log.capUsage) > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Caps Used:</span>
                <span className="text-[#1A9A91] font-black">{log.capUsage}</span>
              </div>
            )}
            {/* Keeping Cap Box usage for completeness if it exists, though not strictly required */}
            {log.capBoxUsage !== undefined && Number(log.capBoxUsage) > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Cap Boxes:</span>
                <span className="text-slate-700 font-black">{log.capBoxUsage} BOX</span>
              </div>
            )}
          </>
        )}

        {/* === LABELING STATION === */}
        {station === 'LABELING' && (
          <>
            {hasRejects && (
              <div className="flex justify-between col-span-2">
                <span>Rejects:</span>
                <span className="text-rose-500 font-black">{formatWastageValue(log.wastageCount)} KG</span>
              </div>
            )}
            {(log.bopRollUsage !== undefined || log.labelStickerWeight !== undefined) && (
              <div className="flex justify-between col-span-2">
                <span>Labels Used:</span>
                <span className="text-[#1A9A91] font-black">{log.bopRollUsage || log.labelStickerWeight} KG</span>
              </div>
            )}
            {(!log.lineName && !log.line?.name ? true : !(log.lineName || log.line?.name)?.toLowerCase().includes('2')) && log.glueUsageKg !== undefined && Number(log.glueUsageKg) > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Glue Used:</span>
                <span className="text-[#1A9A91] font-black">{log.glueUsageKg} KG</span>
              </div>
            )}
            {(log.lineName || log.line?.name)?.toLowerCase().includes('2') && log.rollsUsed !== undefined && Number(log.rollsUsed) > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Rolls Used:</span>
                <span className="text-[#1A9A91] font-black">{log.rollsUsed}</span>
              </div>
            )}
            {/* HTT Used can refer to ink/makeup changes or solvent usage */}
            {(log.inkChanged || log.makeupChanged || Number(log.inkUsage) > 0 || Number(log.solventUsage) > 0) && (
              <div className="flex justify-between col-span-2">
                <span>HTT Used:</span>
                <span className="text-[#1A9A91] font-black">
                   {Number(log.inkUsage) > 0 ? `${log.inkUsage} ML` : 'YES'}
                </span>
              </div>
            )}
          </>
        )}

        {/* === PACKING STATION === */}
        {station === 'PACKING' && (
          <>
            {hasRejects && (
              <div className="flex justify-between col-span-2">
                <span>Rejects:</span>
                <span className="text-rose-500 font-black">
                  {formatWastageValue(log.shrinkWastageKg !== undefined ? log.shrinkWastageKg : log.wastageCount)} KG
                </span>
              </div>
            )}
            {log.secondaryPackagingCount !== undefined && log.secondaryPackagingCount > 0 && (
              <div className="flex justify-between col-span-2">
                <span>Boxes Used:</span>
                <span className="text-[#1A9A91] font-black">{log.secondaryPackagingCount}</span>
              </div>
            )}
            {log.selectedShrinks && log.selectedShrinks.length > 0 ? (
              <div className="flex flex-col col-span-2 border-t border-slate-200/40 pt-1 mt-1">
                <span className="text-slate-400 font-bold mb-0.5">Shrink Materials Used:</span>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {log.selectedShrinks.map((s, idx) => (
                    <li key={idx} className="flex justify-between text-slate-700">
                      <span>• {s.shrinkName}:</span>
                      <span className="text-[#1A9A91] font-black">{s.mmUsed} KG {s.wastageKg ? `(Wastage: ${s.wastageKg} KG)` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              log.shrinkWeightUsed !== undefined && Number(log.shrinkWeightUsed) > 0 && (
                <div className="flex justify-between col-span-2">
                  <span>Shrink Used:</span>
                  <span className="text-[#1A9A91] font-black">{log.shrinkWeightUsed} KG</span>
                </div>
              )
            )}
          </>
        )}

        {/* Fallback for unknown stations or general anomalies with rejects */}
        {(!['BLOWING', 'FILLING', 'LABELING', 'PACKING'].includes(station || '')) && hasRejects && (
           <div className="flex justify-between col-span-2">
             <span>Rejects:</span>
             <span className="text-rose-500 font-black">{formatWastageValue(log.wastageCount)}</span>
           </div>
        )}
      </div>
    );
  };

  // Compact variant for tables or tight lists
  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-center w-full">
           <span className="text-xs font-bold text-slate-800 uppercase">{log.eventType.replace(/_/g, ' ')}</span>
           {isNormalProd && log.primaryCount > 0 && (
             <span className="text-sm font-black text-[#1A9A91]">+{log.primaryCount}</span>
           )}
        </div>
        {renderStationFields()}
        {log.remarks && (
          <p className="text-[10px] text-slate-500 italic truncate max-w-[200px]">"{log.remarks}"</p>
        )}
      </div>
    );
  }

  // Default Feed Variant (Used in ActivityFeed & BatchLogs)
  return (
    <div className={cn(
      "w-full bg-white border rounded-[12px] p-2.5 transition-all duration-300",
      isAnomaly ? "border-rose-200 bg-rose-50/30" : "border-[#1A9A91]/15 hover:border-[#1A9A91]/35 hover:shadow-[0_4px_12px_rgba(26,154,145,0.04)]"
    )}>
      {/* Header: Event Type & Primary Output */}
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <h4 className={cn(
            "text-xs font-black uppercase tracking-tight flex items-center gap-1.5",
            isAnomaly ? "text-rose-600" : "text-slate-800"
          )}>
            {isAnomaly && <AlertTriangle size={12} />}
            {log.eventType.replace(/_/g, ' ')}
          </h4>
          {log.station && (
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{log.station} Station</span>
          )}
        </div>

        {isNormalProd && log.primaryCount > 0 && (
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black text-slate-900 tracking-tighter">
              +{log.primaryCount.toLocaleString()}
            </span>
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Units</span>
          </div>
        )}
        
        {log.eventType === 'MATERIAL_ASSIGNMENT' && log.primaryCount > 0 && (
          <div className="flex items-baseline gap-1 text-[#1A9A91]">
            <Package size={10} className="self-center mr-0.5" />
            <span className="text-sm font-black tracking-tight">{log.primaryCount.toLocaleString()}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Assigned</span>
          </div>
        )}
      </div>

      {/* Station Specific Dynamic Fields */}
      {renderStationFields()}

      {/* Remarks */}
      {log.remarks && (
        <div className={cn(
          "mt-2 p-2 rounded-lg text-[10px] font-semibold italic flex gap-2 items-start leading-relaxed shadow-inner border",
          isAnomaly ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-slate-50 text-slate-600 border-slate-100"
        )}>
          <AlertTriangle size={12} className={isAnomaly ? "text-rose-500 mt-0.5 shrink-0" : "text-slate-400 mt-0.5 shrink-0"} />
          <span>{log.remarks}</span>
        </div>
      )}

      {/* Footer Details */}
      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider pt-2 mt-2 border-t border-slate-100/80">
        <div className="flex items-center gap-1.5 text-slate-500">
          <User size={10} className="text-slate-400" />
          <span>{log.userName || (log.source === 'MACHINE' ? 'Machine Trigger' : 'System')}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Clock size={10} />
          {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
