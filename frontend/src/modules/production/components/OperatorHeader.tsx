import React from 'react';
import { LogOut, Layout, Power, Loader2 } from 'lucide-react';
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
    <header className="px-8 py-5 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 pr-6 border-r border-gray-200/60">
          <div className="w-10 h-10 bg-[#16857D] rounded-[14px] flex items-center justify-center text-white shadow-[0_2px_10px_rgba(22,133,125,0.24)]">
            <Layout size={20} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-gray-900 leading-none">
              {lineName}
            </h1>
            <p className="text-[11px] font-medium text-gray-500 tracking-wider uppercase mt-1.5">
              {stationName}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none mb-1.5">Active Batch</span>
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-gray-900 tracking-tight">{productName || 'No Product'}</span>
              <span className="text-[10px] font-mono font-medium text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md border border-gray-200/50">
                {batchCode || '---'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Machine Status Pill */}
        <div className={cn(
          "px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-sm transition-all duration-300",
          machineStatus === 'RUNNING' ? "bg-[#16857D]/10 border-[#16857D]/25 text-[#16857D]" :
            machineStatus === 'ERROR' ? "bg-rose-50/50 border-rose-200/60 text-rose-700" :
              "bg-gray-50 border-gray-200/60 text-gray-500"
        )}>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            machineStatus === 'RUNNING' ? "bg-[#16857D] shadow-[0_0_8px_rgba(22,133,125,0.4)]" :
              machineStatus === 'ERROR' ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.4)]" :
                "bg-gray-400"
          )} />
          <span className="text-[10px] font-semibold tracking-wider uppercase">{machineStatus}</span>
        </div>

        <div className="flex items-center gap-3 border-l border-gray-200/60 pl-5 ml-1">
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-[13px] font-semibold text-gray-900 tracking-tight leading-none mb-1">{operatorName}</p>
            <p className="text-[10px] font-medium text-gray-400 tracking-wider uppercase">Active Operator</p>
            {recentHandover && (
              <p className="text-[9px] font-bold text-[#16857D] tracking-wide uppercase mt-1">
                Prev: {recentHandover.outgoingOperatorName} ({new Date(recentHandover.handoverTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onHandover}
              disabled={isLoggingOut}
              className="px-3 py-2.5 bg-[#16857D] hover:bg-[#126B65] text-white font-bold text-xs uppercase tracking-wider rounded-[12px] active:scale-95 transition-all shadow-[0_2px_8px_rgba(22,133,125,0.22)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Shift Handover"
            >
              Shift Handover
            </button>
            <button
              onClick={onChangeStation}
              disabled={isLoggingOut}
              className="px-3 py-2.5 bg-white text-[#16857D] font-bold text-xs uppercase tracking-wider rounded-[12px] hover:bg-[#16857D]/5 active:scale-95 transition-all border border-[#16857D]/25 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Change Station"
            >
              Change Station
            </button>
            <button
              onClick={onDowntime}
              disabled={isLoggingOut}
              className="p-2.5 bg-white text-gray-700 rounded-[12px] hover:bg-gray-50 active:scale-95 transition-all border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Report Downtime"
            >
              <Power size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={onLogout}
              disabled={isLoggingOut}
              className="p-2.5 bg-white text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-[12px] transition-all border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="End Session"
            >
              {isLoggingOut ? <Loader2 size={18} className="animate-spin text-gray-400" /> : <LogOut size={18} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
