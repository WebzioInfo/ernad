import React from 'react';
import { Layers, Loader2, Minus, Plus } from 'lucide-react';

interface ProductionControlsProps {
  primaryCount: number;
  setPrimaryCount: (val: number) => void;
  rejectionCount: number;
  setRejectionCount: (val: number) => void;
  secondaryCount?: number;
  setSecondaryCount?: (val: number) => void;
  primaryLabel: string;
  secondaryLabel?: string;
  stationId: string;
  isSubmitting: boolean;
  onCommit: () => void;
}

const IndustrialInput = ({ label, value, onChange, suffix }: { label: string, value: number, onChange: (val: number) => void, suffix: string }) => (
  <div className="bg-white border border-gray-200/60 rounded-[20px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-5">{label}</label>
    <div className="flex items-center gap-4">
      <button 
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-14 h-14 rounded-[14px] bg-gray-50/50 border border-gray-200/60 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:scale-95 transition-all duration-200 shadow-sm"
      >
        <Minus size={20} strokeWidth={2.5} />
      </button>
      
      <div className="flex-1 relative group">
        <input 
          type="number" 
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder="0"
          className="w-full text-center text-[40px] font-semibold tracking-tight text-gray-900 bg-transparent outline-none focus:text-indigo-600 transition-colors placeholder:text-gray-200"
        />
        <div className="absolute right-2 bottom-2 text-[11px] font-semibold text-gray-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300">{suffix}</div>
      </div>
      
      <button 
        onClick={() => onChange(value + 1)}
        className="w-14 h-14 rounded-[14px] bg-white border border-gray-200/60 flex items-center justify-center text-gray-700 hover:border-indigo-200 hover:text-indigo-600 active:scale-95 transition-all duration-200 shadow-sm"
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
    
    <div className="grid grid-cols-3 gap-3 mt-6">
      {[10, 50, 100].map(inc => (
        <button 
          key={inc}
          onClick={() => onChange(value + inc)}
          className="py-2.5 rounded-[10px] bg-gray-50/50 text-[12px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/60 active:scale-95 transition-all duration-200"
        >
          +{inc}
        </button>
      ))}
    </div>
  </div>
);

export const ProductionControls: React.FC<ProductionControlsProps> = ({
  primaryCount,
  setPrimaryCount,
  rejectionCount,
  setRejectionCount,
  secondaryCount,
  setSecondaryCount,
  primaryLabel,
  secondaryLabel,
  stationId,
  isSubmitting,
  onCommit
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <IndustrialInput 
          label={primaryLabel}
          value={primaryCount}
          onChange={setPrimaryCount}
          suffix="Units"
        />
        
        <IndustrialInput 
          label="Rejects & Waste"
          value={rejectionCount}
          onChange={setRejectionCount}
          suffix="Units"
        />
      </div>

      {secondaryCount !== undefined && setSecondaryCount && (
        <div className="w-full xl:w-1/2 pr-0 xl:pr-3">
          <IndustrialInput 
            label={secondaryLabel || "Secondary Output"}
            value={secondaryCount}
            onChange={setSecondaryCount}
            suffix={stationId === 'BLOWING' ? "Pcs" : "Bags/Box"}
          />
        </div>
      )}

      <button
        onClick={onCommit}
        disabled={isSubmitting}
        className="w-full h-20 mt-8 bg-black text-white rounded-[20px] font-semibold tracking-wide text-lg flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 transition-all duration-300 active:translate-y-0.5 active:shadow-sm"
      >
        {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Layers size={24} strokeWidth={2.5} />}
        Commit To Ledger
      </button>
    </div>
  );
};
