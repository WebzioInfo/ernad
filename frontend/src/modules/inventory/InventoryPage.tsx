import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import {
  Plus, Package, Droplet, RefreshCcw,
  Search, History, AlertCircle, Check, Loader2, X,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [updatingMaterial, setUpdatingMaterial] = useState<any>(null);
  const [viewingLedger, setViewingLedger] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await api.get('/inventory')).data,
    refetchInterval: 10000
  });

  const updateStockMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/stock', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (viewingLedger) queryClient.invalidateQueries({ queryKey: ['ledger', viewingLedger.id] });
      toast.success('Stock updated');
      setUpdatingMaterial(null);
    }
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/materials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Material added');
      setIsCreateModalOpen(false);
    }
  });

  const filteredInventory = inventory?.filter((m: any) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(inventory?.map((m: any) => m.category) || [])) as string[]];

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <Package className="w-10 h-10 text-indigo-600" />
            Inventory
          </h1>
          <p className="text-slate-500 font-medium mt-2">Track stock and usage.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-indigo-100 transition-all active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Add Material
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search materials by name or category..."
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-14 pr-6 font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-lg'
                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List View (Table) */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Current Stock</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Min. Required</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInventory?.map((material: any) => {
                const isLow = parseFloat(material.currentStock) <= parseFloat(material.minimumStock);
                return (
                  <tr key={material.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isLow ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                          <Droplet className="w-5 h-5" />
                        </div>
                        <span className="font-black text-slate-900 tracking-tight">{material.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {material.category}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      {isLow ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full border border-rose-100 animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Low Stock</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
                          <Check className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Healthy</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`text-lg font-black ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                        {parseFloat(material.currentStock).toLocaleString()}
                        <span className="text-[10px] text-slate-400 ml-1.5 font-bold uppercase">{material.unit}</span>
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="text-sm font-bold text-slate-500">
                        {parseFloat(material.minimumStock).toLocaleString()} {material.unit}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setUpdatingMaterial(material)}
                          className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm"
                          title="Update Stock"
                        >
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewingLedger(material)}
                          className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all shadow-sm"
                          title="View History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {updatingMaterial && (
        <StockUpdateModal
          material={updatingMaterial}
          onClose={() => setUpdatingMaterial(null)}
          onSubmit={(data: any) => updateStockMutation.mutate(data)}
          isPending={updateStockMutation.isPending}
        />
      )}

      {viewingLedger && (
        <LedgerModal
          material={viewingLedger}
          onClose={() => setViewingLedger(null)}
        />
      )}

      {isCreateModalOpen && (
        <CreateMaterialModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data: any) => createMaterialMutation.mutate(data)}
          isPending={createMaterialMutation.isPending}
        />
      )}
    </div>
  );
}


function LedgerModal({ material, onClose }: any) {
  const { data: ledger, isLoading } = useQuery({
    queryKey: ['ledger', material.id],
    queryFn: async () => (await api.get(`/inventory/${material.id}/ledger`)).data
  });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{material.name} Logs</h3>
            <p className="text-slate-500 font-medium mt-1">List of changes</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
          ) : ledger?.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold">No transactions found for this material.</div>
          ) : (
            <div className="space-y-4">
              {ledger?.map((tx: any) => (
                <div key={tx.id} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600' :
                      tx.type === 'OUT' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                      {tx.type === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> :
                        tx.type === 'OUT' ? <ArrowUpRight className="w-5 h-5" /> : <RefreshCcw className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-wide">{tx.type} TRANSACTION</p>
                      <p className="text-xs text-slate-400 font-medium">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${tx.type === 'IN' ? 'text-emerald-600' :
                      tx.type === 'OUT' ? 'text-rose-600' : 'text-blue-600'
                      }`}>
                      {tx.type === 'OUT' ? '-' : tx.type === 'IN' ? '+' : ''}{parseFloat(tx.quantity).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{tx.remarks || 'No remarks'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StockUpdateModal({ material, onClose, onSubmit, isPending }: any) {
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [remarks, setRemarks] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Stock Transaction</h3>
          <p className="text-slate-500 font-medium mb-8 uppercase text-[10px] tracking-widest font-black">Material: {material.name}</p>

          <div className="space-y-6">
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
              {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity ({material.unit})</label>
              <input
                type="number"
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-lg font-black focus:ring-4 focus:ring-indigo-100 transition-all"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference / Remarks</label>
              <input
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-sm font-semibold focus:ring-4 focus:ring-indigo-100 transition-all"
                placeholder="e.g. PO-992 or Manual Correction"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="pt-6 flex gap-4">
              <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">
                Cancel
              </button>
              <button
                onClick={() => onSubmit({ materialId: material.id, quantity: parseFloat(quantity), type, remarks })}
                disabled={!quantity || isNaN(parseFloat(quantity)) || isPending}
                className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateMaterialModal({ onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [minimumStock, setMinimumStock] = useState('0');
  const [category, setCategory] = useState('Packaging');
  const [customCategory, setCustomCategory] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Define Material</h3>

          <div className="space-y-5">
            <FormField label="Material Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-bold border-none" placeholder="e.g. Preforms 1L" />
            </FormField>

            <FormField label="Category">
              <select
                value={category === 'Packaging' || category === 'Closure' || category === 'Consumable' || category === 'Raw Liquid' ? category : 'Others'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== 'Others') {
                    setCategory(val);
                    setCustomCategory('');
                  } else {
                    setCategory('Others');
                  }
                }}
                className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-bold border-none appearance-none"
              >
                <option value="Packaging">Packaging</option>
                <option value="Closure">Closure</option>
                <option value="Consumable">Consumable</option>
                <option value="Raw Liquid">Raw Liquid</option>
                <option value="Others">Others</option>
              </select>
            </FormField>

            {(category === 'Others' || (category !== 'Packaging' && category !== 'Closure' && category !== 'Consumable' && category !== 'Raw Liquid' && category !== '')) && (
              <FormField label="Custom Category Name">
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-bold border-none animate-in slide-in-from-top-2 duration-300"
                  placeholder="e.g. Spare Parts"
                />
              </FormField>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Base Unit">
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-bold border-none appearance-none">
                  <option value="Pcs">Pcs</option>
                  <option value="Bags">Bags</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Kg">Kg</option>
                  <option value="Ltr">Ltr</option>
                </select>
              </FormField>
              <FormField label="Min. Alert">
                <input type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-4 font-bold border-none" />
              </FormField>
            </div>

            <div className="pt-6 flex gap-4">
              <button onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-bold">Cancel</button>
              <button
                onClick={() => onSubmit({ name, unit, category: category === 'Others' ? customCategory : category, minimumStock })}
                disabled={!name || (category === 'Others' && !customCategory) || isPending}
                className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Material
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
