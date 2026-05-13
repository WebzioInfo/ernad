import React from 'react';
import { PackageSearch, AlertTriangle } from 'lucide-react';

interface MaterialPanelProps {
  stationId: string;
  inventory: any[];
  selectedStockId: string;
  setSelectedStockId: (id: string) => void;
  packingConfigs?: any[];
  packingConfigId?: string;
  setPackingConfigId?: (id: string) => void;
  inkUsage?: number;
  setInkUsage?: (val: number) => void;
  solventUsage?: number;
  setSolventUsage?: (val: number) => void;
  remarks: string;
  setRemarks: (val: string) => void;
}

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
  stationId,
  inventory,
  selectedStockId,
  setSelectedStockId,
  packingConfigs,
  packingConfigId,
  setPackingConfigId,
  inkUsage,
  setInkUsage,
  solventUsage,
  setSolventUsage,
  remarks,
  setRemarks
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Material Selection */}
      <div className="bg-white border border-gray-200/60 rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-[10px] bg-indigo-50/50 flex items-center justify-center text-indigo-600 border border-indigo-100/50">
            <PackageSearch size={16} strokeWidth={2.5} />
          </div>
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Material Logistics</h3>
        </div>
        
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest ml-1">Source Batch</label>
            <select
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
              className="w-full h-12 bg-gray-50/50 border border-gray-200/60 rounded-[12px] px-4 text-[13px] font-semibold text-gray-900 outline-none focus:border-indigo-500/50 focus:ring-[3px] focus:ring-indigo-500/10 transition-all appearance-none"
            >
              <option value="">Select Stock Batch...</option>
              {inventory?.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.itemName} • {item.quantity} {item.unit} available
                </option>
              ))}
            </select>
          </div>

          {stationId === 'PACKING' && packingConfigs && setPackingConfigId && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest ml-1">Packing Configuration</label>
              <select
                value={packingConfigId}
                onChange={(e) => setPackingConfigId(e.target.value)}
                className="w-full h-12 bg-gray-50/50 border border-gray-200/60 rounded-[12px] px-4 text-[13px] font-semibold text-gray-900 outline-none focus:border-indigo-500/50 focus:ring-[3px] focus:ring-indigo-500/10 transition-all appearance-none"
              >
                <option value="">Select Config...</option>
                {packingConfigs.map((config: any) => (
                  <option key={config.id} value={config.id}>{config.name}</option>
                ))}
              </select>
            </div>
          )}

          {stationId === 'LABELING' && setInkUsage && setSolventUsage && (
             <div className="grid grid-cols-2 gap-4 pt-5 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest ml-1">Ink (g)</label>
                  <input
                    type="number"
                    value={inkUsage === 0 ? '' : inkUsage}
                    onChange={(e) => setInkUsage(Number(e.target.value))}
                    className="w-full h-12 bg-gray-50/50 border border-gray-200/60 rounded-[12px] px-4 text-[13px] font-semibold text-gray-900 outline-none text-center focus:border-indigo-500/50 focus:ring-[3px] focus:ring-indigo-500/10 transition-all"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest ml-1">Solvent (g)</label>
                  <input
                    type="number"
                    value={solventUsage === 0 ? '' : solventUsage}
                    onChange={(e) => setSolventUsage(Number(e.target.value))}
                    className="w-full h-12 bg-gray-50/50 border border-gray-200/60 rounded-[12px] px-4 text-[13px] font-semibold text-gray-900 outline-none text-center focus:border-indigo-500/50 focus:ring-[3px] focus:ring-indigo-500/10 transition-all"
                    placeholder="0"
                  />
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Anomaly / Remarks */}
      <div className="bg-amber-50/30 border border-amber-200/40 rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className="text-amber-500" size={16} strokeWidth={2.5} />
          <h4 className="text-[11px] font-semibold text-amber-900 uppercase tracking-widest">Shift Notes & Issues</h4>
        </div>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Log machine stops, material issues, or general remarks..."
          className="w-full h-24 bg-white/60 border border-amber-200/60 rounded-[16px] p-4 text-[13px] font-medium text-gray-800 placeholder:text-amber-900/30 outline-none focus:border-amber-500/50 focus:ring-[3px] focus:ring-amber-500/10 transition-all resize-none"
        />
      </div>
    </div>
  );
};
