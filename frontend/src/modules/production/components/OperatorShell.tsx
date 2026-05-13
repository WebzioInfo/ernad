import React from 'react';

interface OperatorShellProps {
  header: React.ReactNode;
  kpiStrip: React.ReactNode;
  mainWorkspace: React.ReactNode;
  activityPanel: React.ReactNode;
}

export const OperatorShell: React.FC<OperatorShellProps> = ({
  header,
  kpiStrip,
  mainWorkspace,
  activityPanel,
}) => {
  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col overflow-hidden font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header and KPI Strip are sticky at the top */}
      <div className="flex-none bg-white/80 backdrop-blur-xl border-b border-gray-200/60 z-20 sticky top-0">
        {header}
        {kpiStrip}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Left Side: Main Workspace (70%) */}
        <div className="flex-[7] min-w-0 overflow-y-auto custom-scrollbar relative">
          <div className="p-6 md:p-10 max-w-[1200px] mx-auto space-y-8">
            {mainWorkspace}
          </div>
        </div>

        {/* Right Side: Activity Panel (30%) */}
        <div className="flex-[3] min-w-0 md:min-w-[340px] max-w-[420px] border-l border-gray-200/60 bg-white/50 backdrop-blur-md flex flex-col overflow-hidden">
          {activityPanel}
        </div>
        
      </div>
    </div>
  );
};
