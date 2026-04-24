import { useState } from 'react';
import DashboardLayout from './DashboardLayout';
import OverviewTab from './OverviewTab';
import EfficiencyDashboard from './EfficiencyDashboard';
import ProductionTab from './ProductionTab';
import { api } from '../../../api';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    lineId: 'LINE_1',
    brandId: 'all',
    productId: 'all',
    shiftId: 'all'
  });

  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/master-data/brands')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/master-data/products')).data });

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab filters={filters} />;
      case 'analytics':
        return <EfficiencyDashboard filters={filters} />;
      case 'production':
        return <ProductionTab filters={filters} />;
      case 'inventory':
        return <div className="p-20 text-center font-bold text-slate-400">Inventory Module Coming Soon</div>;
      case 'users':
        return <div className="p-20 text-center font-bold text-slate-400">User Management Module Coming Soon</div>;
      default:
        return <OverviewTab filters={filters} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="mb-10 flex flex-wrap items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
           <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Filter className="w-5 h-5" />
           </div>
           <span className="text-sm font-black text-slate-900 tracking-tight">Active Filters</span>
        </div>
        
        <select 
          value={filters.lineId}
          onChange={(e) => setFilters({...filters, lineId: e.target.value})}
          className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
        >
          <option value="LINE_1">Production Line 1</option>
          <option value="LINE_2">Production Line 2</option>
        </select>

        <select 
          value={filters.brandId}
          onChange={(e) => setFilters({...filters, brandId: e.target.value})}
          className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
        >
          <option value="all">All Brands</option>
          {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select 
          value={filters.productId}
          onChange={(e) => setFilters({...filters, productId: e.target.value})}
          className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 cursor-pointer"
        >
          <option value="all">All Product Sizes</option>
          {products?.filter((p: any) => filters.brandId === 'all' || p.brandId === filters.brandId).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {renderContent()}
    </DashboardLayout>
  );
}
