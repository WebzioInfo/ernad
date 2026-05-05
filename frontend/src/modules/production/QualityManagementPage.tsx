import {
  ClipboardCheck,
  PackageCheck,
  Truck,
  AlertCircle,
  Search
} from 'lucide-react';

import {
  BatchTrackingView
} from './components/BatchLifecycleViews';
import { useState } from 'react';

export default function QualityManagementPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'qc' | 'packaging' | 'dispatch'>('batches');

  const tabs = [
    { id: 'batches', label: 'Batch Tracking', icon: ClipboardCheck },
    { id: 'qc', label: 'Quality Checks', icon: PackageCheck },
    { id: 'packaging', label: 'Packaging Logs', icon: PackageCheck },
    { id: 'dispatch', label: 'Dispatch Control', icon: Truck },
  ];

  const renderContent = () => {
    if (activeTab === 'batches') return <BatchTrackingView />;

    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100">
          <AlertCircle className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Feature Coming Soon</h3>
        <p className="text-slate-500 max-w-sm mt-2 font-medium">
          The {tabs.find(t => t.id === activeTab)?.label} module is currently under architectural review and will be available in the next deployment.
        </p>
        <div className="mt-8 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
          Scheduled for v3.2
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Quality & Lifecycle</h2>
          <p className="text-slate-500 font-medium mt-1">Traceability from batch creation to dispatch</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
            <Search className="w-4 h-4" />
            <span>Trace Batch ID</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-[2rem] w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-sm transition-all
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
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  );
}
