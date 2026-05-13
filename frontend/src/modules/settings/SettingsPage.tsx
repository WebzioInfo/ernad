import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api-client';
import { toast } from 'sonner';
import { ENDPOINTS } from '../../constants/endpoints';
import {
  Settings, Tags, Box, Factory, Clock,
  Plus, Trash2, Loader2
} from 'lucide-react';

// --- Shared Types ---
type Brand = { id: string; name: string; description: string; isActive: boolean };
type Product = { id: string; name: string; brandId: string; targetWeight: number; targetSpeed: number; unit: string; sku: string };
type Line = { id: string; name: string; status: string; efficiency: number };
type Shift = { id: string; name: string; startTime: string; endTime: string };

// --- Subcomponents ---

const BrandsTab = () => {
  const queryClient = useQueryClient();
  const { data: brands, isLoading } = useQuery<Brand[]>({ queryKey: ['brands'], queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.BRANDS)).data });
  const [isAdding, setIsAdding] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: '', description: '' });

  const createMutation = useMutation({
    mutationFn: async (data: any) => await api.post(ENDPOINTS.MASTER_DATA.BRANDS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand added successfully');
      setIsAdding(false);
      setNewBrand({ name: '', description: '' });
    },
    onError: () => toast.error('Failed to add brand')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.name) return toast.error('Name is required');
    createMutation.mutate(newBrand);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Brands</h3>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Brand
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand Name</label>
              <input type="text" value={newBrand.name} onChange={e => setNewBrand({ ...newBrand, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Ernad Premium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
              <input type="text" value={newBrand.description} onChange={e => setNewBrand({ ...newBrand, description: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional details..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Brand'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-black">
            <tr>
              <th className="px-6 py-4">Brand Name</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brands?.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No brands found.</td></tr>
            )}
            {brands?.map(b => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{b.name}</td>
                <td className="px-6 py-4 text-slate-600">{b.description || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProductsTab = () => {
  const queryClient = useQueryClient();
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({ queryKey: ['products'], queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.PRODUCTS)).data });
  const { data: brands, isLoading: isLoadingBrands } = useQuery<Brand[]>({ queryKey: ['brands'], queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.BRANDS)).data });
  
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', brandId: '', sku: '', targetWeight: 0, targetSpeed: 0, unit: 'BOTTLES' });

  const createMutation = useMutation({
    mutationFn: async (data: any) => await api.post(ENDPOINTS.MASTER_DATA.PRODUCTS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product added successfully');
      setIsAdding(false);
      setNewProduct({ name: '', brandId: '', sku: '', targetWeight: 0, targetSpeed: 0, unit: 'BOTTLES' });
    },
    onError: () => toast.error('Failed to add product')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.brandId || !newProduct.sku) return toast.error('Name, Brand, and SKU are required');
    createMutation.mutate({
      ...newProduct,
      targetWeight: Number(newProduct.targetWeight),
      targetSpeed: Number(newProduct.targetSpeed)
    });
  };

  if (isLoadingProducts || isLoadingBrands) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Products</h3>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label>
              <input type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., 500ml Water" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand</label>
              <select value={newProduct.brandId} onChange={e => setNewProduct({ ...newProduct, brandId: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Select Brand...</option>
                {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SKU</label>
              <input type="text" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., ERN-500-W" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Weight (g)</label>
              <input type="number" value={newProduct.targetWeight} onChange={e => setNewProduct({ ...newProduct, targetWeight: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Speed (/hr)</label>
              <input type="number" value={newProduct.targetSpeed} onChange={e => setNewProduct({ ...newProduct, targetSpeed: Number(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
              <select value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="BOTTLES">Bottles</option>
                <option value="BOXES">Boxes</option>
                <option value="LITERS">Liters</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Product'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-black">
            <tr>
              <th className="px-6 py-4">SKU / Product</th>
              <th className="px-6 py-4">Brand</th>
              <th className="px-6 py-4">Targets</th>
              <th className="px-6 py-4">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products?.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No products found.</td></tr>
            )}
            {products?.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sku}</div>
                </td>
                <td className="px-6 py-4 text-slate-600">{brands?.find(b => b.id === p.brandId)?.name || 'Unknown'}</td>
                <td className="px-6 py-4">
                  <div className="text-sm"><span className="text-slate-400">Wt:</span> {p.targetWeight}g</div>
                  <div className="text-sm"><span className="text-slate-400">Spd:</span> {p.targetSpeed}/hr</div>
                </td>
                <td className="px-6 py-4 font-mono text-sm text-slate-600">{p.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LinesTab = () => {
  const queryClient = useQueryClient();
  const { data: lines, isLoading } = useQuery<Line[]>({ queryKey: ['lines'], queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data });
  const [isAdding, setIsAdding] = useState(false);
  const [newLine, setNewLine] = useState({ id: '', name: '' });

  const createMutation = useMutation({
    mutationFn: async (data: any) => await api.post(ENDPOINTS.MASTER_DATA.LINES, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      toast.success('Line added successfully');
      setIsAdding(false);
      setNewLine({ id: '', name: '' });
    },
    onError: () => toast.error('Failed to add line')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(ENDPOINTS.MASTER_DATA.LINE(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      toast.success('Line deleted successfully');
    },
    onError: () => toast.error('Failed to delete line')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine.id || !newLine.name) return toast.error('ID and Name are required');
    createMutation.mutate(newLine);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Production Lines</h3>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Line
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Line ID</label>
              <input type="text" value={newLine.id} onChange={e => setNewLine({ ...newLine, id: e.target.value.toUpperCase() })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., L1" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Line Name</label>
              <input type="text" value={newLine.name} onChange={e => setNewLine({ ...newLine, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Main Bottling Line" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Line'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-black">
            <tr>
              <th className="px-6 py-4">Line ID</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines?.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No lines found.</td></tr>
            )}
            {lines?.map(l => (
              <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{l.id}</td>
                <td className="px-6 py-4 text-slate-600">{l.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    l.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-700' :
                    l.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => {
                    if (confirm(`Are you sure you want to delete Line ${l.id}?`)) {
                      deleteMutation.mutate(l.id);
                    }
                  }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ShiftsTab = () => {
  const queryClient = useQueryClient();
  const { data: shifts, isLoading } = useQuery<Shift[]>({ queryKey: ['shifts'], queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.SHIFTS)).data });
  const [isAdding, setIsAdding] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', startTime: '08:00', endTime: '16:00' });

  const createMutation = useMutation({
    mutationFn: async (data: any) => await api.post(ENDPOINTS.MASTER_DATA.SHIFTS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift added successfully');
      setIsAdding(false);
      setNewShift({ name: '', startTime: '08:00', endTime: '16:00' });
    },
    onError: () => toast.error('Failed to add shift')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(ENDPOINTS.MASTER_DATA.SHIFT(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift deleted successfully');
    },
    onError: () => toast.error('Failed to delete shift')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShift.name) return toast.error('Name is required');
    createMutation.mutate(newShift);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Operating Shifts</h3>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Shift
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift Name (ID)</label>
              <input type="text" value={newShift.name} onChange={e => setNewShift({ ...newShift, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., MORNING_SHIFT" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
              <input type="time" value={newShift.startTime} onChange={e => setNewShift({ ...newShift, startTime: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
              <input type="time" value={newShift.endTime} onChange={e => setNewShift({ ...newShift, endTime: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Shift'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-black">
            <tr>
              <th className="px-6 py-4">Shift Name</th>
              <th className="px-6 py-4">Schedule</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shifts?.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No shifts found.</td></tr>
            )}
            {shifts?.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                <td className="px-6 py-4 text-slate-600">
                  {s.startTime} - {s.endTime}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => {
                    if (confirm(`Delete Shift ${s.name}?`)) deleteMutation.mutate(s.id);
                  }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'brands' | 'products' | 'lines' | 'shifts'>('brands');

  const tabs = [
    { id: 'brands', label: 'Brands', icon: Tags },
    { id: 'products', label: 'Products', icon: Box },
    { id: 'lines', label: 'Production Lines', icon: Factory },
    { id: 'shifts', label: 'Shifts', icon: Clock },
  ] as const;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Settings</h1>
            <p className="text-slate-500 font-medium">Manage master data, production entities, and factory configuration</p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Sidebar Navigation */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-9">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
            {activeTab === 'brands' && <BrandsTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'lines' && <LinesTab />}
            {activeTab === 'shifts' && <ShiftsTab />}
          </div>
        </div>

      </div>
    </div>
  );
}
