import {
  ClipboardCheck,
  PackageCheck,
  Truck,
  Search,
  LayoutDashboard
} from 'lucide-react';

import {
  BatchTrackingView,
  QualityCheckView,
  PackagingView,
  DispatchView
} from './components/BatchLifecycleViews';
import { useState } from 'react';

export default function QualityManagementPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'qc' | 'packaging' | 'dispatch'>('batches');

  const tabs = [
    { id: 'batches', label: 'Batch Tracking', icon: LayoutDashboard },
    { id: 'qc', label: 'Quality Checks', icon: ClipboardCheck },
    { id: 'packaging', label: 'Packaging Logs', icon: PackageCheck },
    { id: 'dispatch', label: 'Dispatch Control', icon: Truck },
  ];

  const renderContent = () => {
    switch(activeTab) {
      case 'batches': return <BatchTrackingView />;
      case 'qc': return <QualityCheckView />;
      case 'packaging': return <PackagingView />;
      case 'dispatch': return <DispatchView />;
      default: return <BatchTrackingView />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Quality Assurance</h2>
          <p className="text-slate-500 font-medium mt-1">Traceability matrix and operational logs</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
            <Search className="w-4 h-4" />
            <span>Trace Batch</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-[2rem] w-fit overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-sm transition-all whitespace-nowrap
                ${isActive
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px]">
        {renderContent()}
      </div>
    </div>
  );
}
