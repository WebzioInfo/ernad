import React from 'react';
import { LogOut, Power, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperatorHeaderProps {
  lineName: string;
  stationName: string;
  operatorName: string;
  batchCode?: string;
  productName?: string;
  onLogout: () => void;
  onChangeStation: () => void;
  onDowntime: () => void;
  onHandover: () => void;
  isLoggingOut?: boolean;
  machineStatus: 'RUNNING' | 'IDLE' | 'ERROR';
  recentHandover?: {
    outgoingOperatorName: string;
    handoverTime: string;
  } | null;
}

export const OperatorHeader: React.FC<OperatorHeaderProps> = ({
  lineName,
  stationName,
  operatorName,
  batchCode,
  productName,
  onLogout,
  onDowntime,
  onChangeStation,
  onHandover,
  isLoggingOut,
  machineStatus,
  recentHandover
}) => {
  return (
    <header className="px-4 py-3 sm:px-8 sm:py-5 flex items-center justify-between border-b border-gray-100 bg-white">
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4 pr-3 sm:pr-6 border-r border-gray-200/60">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[18px] flex items-center justify-center bg-white overflow-hidden shrink-0 border border-gray-100 shadow-sm">
            <img src="/fav-nobg.png" alt="Product logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xs sm:text-[15px] font-bold sm:font-semibold tracking-tight text-gray-900 leading-none">
              {lineName}
            </h1>
            <p className="text-[9px] sm:text-[11px] font-bold sm:font-medium text-gray-500 tracking-wider uppercase mt-1 sm:mt-1.5">
              {stationName}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none mb-1 sm:mb-1.5">Active Batch</span>
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="text-xs sm:text-[13px] font-semibold text-gray-900 tracking-tight truncate max-w-[120px] sm:max-w-none">{productName || 'No Product'}</span>
              <span className="text-[8px] sm:text-[10px] font-mono font-medium text-gray-500 bg-gray-100/80 px-1.5 py-0.5 rounded border border-gray-200/50">
                {batchCode || '---'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Machine Status Pill */}
        <div className={cn(
          "px-2 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 border shadow-sm transition-all duration-300",
          machineStatus === 'RUNNING' ? "bg-[#1A9A91]/10 border-[#1A9A91]/25 text-[#1A9A91]" :
            machineStatus === 'ERROR' ? "bg-rose-50/50 border-rose-200/60 text-rose-700" :
              "bg-gray-50 border-gray-200/60 text-gray-500"
        )}>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            machineStatus === 'RUNNING' ? "bg-[#1A9A91] shadow-[0_0_8px_rgba(26,154,145,0.4)]" :
              machineStatus === 'ERROR' ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)]" :
                "bg-gray-400"
          )} />
          <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase">{machineStatus}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 border-l border-gray-200/60 pl-2 sm:pl-5 ml-0.5 sm:ml-1">
          <div className="text-right mr-1 sm:mr-2 hidden md:block">
            <p className="text-xs sm:text-[13px] font-semibold text-gray-900 tracking-tight leading-none mb-1">{operatorName}</p>
            <p className="text-[9px] sm:text-[10px] font-medium text-gray-400 tracking-wider uppercase">Active Operator</p>
            {recentHandover && (
              <p className="text-[8px] font-bold text-[#1A9A91] tracking-wide uppercase mt-1">
                Prev: {recentHandover.outgoingOperatorName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={onHandover}
              disabled={isLoggingOut}
              className="px-2 py-2 sm:px-3 sm:py-2.5 bg-[#1A9A91] hover:bg-[#157C75] text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider rounded-lg sm:rounded-[12px] active:scale-95 transition-all shadow-[0_2px_8px_rgba(26,154,145,0.22)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Shift Handover"
            >
              Shift Handover
            </button>
            <button
              onClick={onChangeStation}
              disabled={isLoggingOut}
              className="px-2 py-2 sm:px-3 sm:py-2.5 bg-white text-[#1A9A91] font-bold text-[10px] sm:text-xs uppercase tracking-wider rounded-lg sm:rounded-[12px] hover:bg-[#1A9A91]/5 active:scale-95 transition-all border border-[#1A9A91]/25 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Change Station"
            >
              Change Station
            </button>
            <button
              onClick={onDowntime}
              disabled={isLoggingOut}
              className="p-2 sm:p-2.5 bg-white text-gray-700 rounded-lg sm:rounded-[12px] hover:bg-gray-50 active:scale-95 transition-all border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Report Downtime"
            >
              <Power size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
            </button>
            <button
              onClick={onLogout}
              disabled={isLoggingOut}
              className="p-2 sm:p-2.5 bg-white text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-lg sm:rounded-[12px] transition-all border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="End Session"
            >
              {isLoggingOut ? <Loader2 size={16} className="sm:w-[18px] sm:h-[18px] animate-spin text-gray-400" /> : <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
