import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../../constants/endpoints';
import { api } from '../../services/api-client';
import {
  Plus, Package, Droplet, RefreshCcw,
  Search, History, AlertCircle, Check, Loader2, X,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Tag,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [updatingMaterial, setUpdatingMaterial] = useState<any>(null);
  const [viewingLedger, setViewingLedger] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'config'>('ledger');

  const queryClient = useQueryClient();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.LIST)).data,  });

  const { data: categoriesData } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.CATEGORIES)).data,
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.WAREHOUSES)).data,
  });

  const updateStockMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.INVENTORY.STOCK, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (viewingLedger) queryClient.invalidateQueries({ queryKey: ['ledger', viewingLedger.id] });
      toast.success('Stock ledger updated successfully');
      setUpdatingMaterial(null);
    }
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.INVENTORY.ITEMS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Enterprise Stock Item Created');
      setIsCreateModalOpen(false);
    }
  });

  const filteredInventory = inventory?.filter((m: any) => {
    const matchesSearch = (m.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(inventory?.map((m: any) => m.categoryName) || [])) as string[]];

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-2xl" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Enterprise Ledger...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="bg-slate-950 p-12 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <Package className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                Inventory Supply
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-indigo-400 uppercase tracking-widest">Enterprise</span>
              </h1>
              <p className="text-slate-400 font-bold mt-2 text-sm">Industrial resource tracking with automated depletion alerts.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex bg-white/5 p-1.5 rounded-[1.5rem] border border-white/10">
              <button 
                onClick={() => setActiveTab('ledger')}
                className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ledger' ? 'bg-white text-slate-950 shadow-xl' : 'text-white/40 hover:text-white'}`}
              >
                Stock Ledger
              </button>
              <button 
                onClick={() => setActiveTab('config')}
                className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-white text-slate-950 shadow-xl' : 'text-white/40 hover:text-white'}`}
              >
                Configuration
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl transition-all whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Add Stock Batch
            </motion.button>
          </div>
        </div>
      </div>

      {activeTab === 'ledger' ? (
        <>
          {/* Filters */}
          <div className="bg-white/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Query materials by SKU or Item Name..."
                className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-5 pl-16 pr-8 font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]'
                    : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
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
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material / SKU</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category & Warehouse</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Current Stock</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Min. Required</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <AnimatePresence mode="popLayout">
                    {filteredInventory?.map((material: any, idx: number) => {
                      const isLow = parseFloat(material.quantity) <= parseFloat(material.minimumStock);
                      return (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.03 }}
                          key={material.id} 
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all group-hover:scale-110 ${isLow ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-lg' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-lg'
                                }`}>
                                <Droplet className="w-7 h-7" />
                              </div>
                              <div>
                                <span className="font-black text-slate-900 tracking-tight text-lg block">{material.itemName}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Hash className="w-3 h-3 text-slate-400" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{material.sku || 'NO-SKU'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Tag className="w-3 h-3 text-slate-400" />
                                <span className="px-3 py-1 bg-slate-900/5 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-[0.1em]">
                                  {material.categoryName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{material.warehouseName}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            {isLow ? (
                              <div className="inline-flex items-center gap-2 bg-rose-600 text-white px-5 py-2 rounded-xl shadow-xl shadow-rose-200 animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Depleted</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2 rounded-xl shadow-xl shadow-emerald-100">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Optimal</span>
                              </div>
                            )}
                          </td>
                          <td className="px-10 py-8 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-2xl font-black tabular-nums tracking-tighter ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                                {parseFloat(material.quantity).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{material.unit} available</span>
                            </div>
                          </td>
                          <td className="px-10 py-8 text-right">
                            <div className="flex flex-col items-end opacity-60">
                              <span className="text-base font-black text-slate-500 tabular-nums">
                                {parseFloat(material.minimumStock).toLocaleString()}
                              </span>
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Trigger Level</span>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex items-center justify-center gap-3">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setUpdatingMaterial(material)}
                                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm"
                                title="Update Stock"
                              >
                                <RefreshCcw className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setViewingLedger(material)}
                                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all shadow-sm"
                                title="View History"
                              >
                                <History className="w-5 h-5" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <InventoryConfigView 
          categories={categoriesData} 
          warehouses={warehousesData} 
          queryClient={queryClient}
        />
      )}

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
          categories={categoriesData}
          warehouses={warehousesData}
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
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.LEDGER(material.id))).data
  });

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col border border-white">
        <div className="p-12 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{material.itemName} Ledger</h3>
            <p className="text-slate-500 font-bold mt-1 text-sm">Full immutable transaction history</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white rounded-3xl transition-all shadow-sm">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 scrollbar-hide space-y-4">
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-slate-200" /></div>
          ) : ledger?.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
              <History className="w-16 h-16" />
              <p className="font-black uppercase tracking-widest text-xs">No transactions recorded</p>
            </div>
          ) : (
            ledger?.map((tx: any) => (
              <div key={tx.id} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all duration-500">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${
                    tx.type === 'IN' ? 'bg-emerald-50 text-emerald-600' :
                    tx.type === 'OUT' || tx.type === 'CONSUMPTION' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {tx.type === 'IN' ? <ArrowDownLeft className="w-7 h-7" /> :
                      tx.type === 'OUT' || tx.type === 'CONSUMPTION' ? <ArrowUpRight className="w-7 h-7" /> : <RefreshCcw className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{tx.type}</p>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-slate-500 font-bold mt-1">{tx.remarks || 'Automated transaction'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black tabular-nums tracking-tighter ${
                    tx.type === 'IN' ? 'text-emerald-600' :
                    tx.type === 'OUT' || tx.type === 'CONSUMPTION' ? 'text-rose-600' : 'text-blue-600'
                  }`}>
                    {Number(tx.quantityChange) > 0 ? '+' : ''}{parseFloat(tx.quantityChange).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Balance: {parseFloat(tx.balanceAfter).toLocaleString()}</p>
                </div>
              </div>
            ))
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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
        <div className="p-12">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Stock Transaction</h3>
          <p className="text-indigo-600 font-black uppercase text-[10px] tracking-[0.2em]">Material: {material.itemName}</p>

          <div className="space-y-8 mt-10">
            <div className="flex gap-2 p-2 bg-slate-100 rounded-2xl">
              {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest transition-all ${type === t ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity ({material.unit})</label>
              <input
                type="number"
                className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-8 py-6 text-3xl font-black focus:ring-0 focus:border-indigo-600/20 focus:bg-white transition-all text-slate-900"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Memo / Reference</label>
              <textarea
                className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-8 py-5 text-sm font-bold focus:ring-0 focus:border-indigo-600/20 focus:bg-white transition-all text-slate-700 h-24 resize-none"
                placeholder="Describe this stock movement..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="pt-6 flex gap-4">
              <button onClick={onClose} className="flex-1 py-6 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                Discard
              </button>
              <button
                onClick={() => onSubmit({ stockId: material.id, quantity: parseFloat(quantity), type, remarks })}
                disabled={!quantity || isNaN(parseFloat(quantity)) || isPending}
                className="flex-[2] py-6 bg-slate-950 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Confirm Entry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateMaterialModal({ categories, warehouses, onClose, onSubmit, isPending }: any) {
  const [itemName, setItemName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [minimumStock, setMinimumStock] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
        <div className="p-12">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-10">Register Stock Batch</h3>

          <div className="space-y-6">
            <FormField label="Item Commercial Name">
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 outline-none" placeholder="e.g. Blue Closure 30mm" />
            </FormField>

            <FormField label="Internal SKU / Part Number">
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 outline-none" placeholder="e.g. SKU-CAP-30B" />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Material Category">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none appearance-none">
                  <option value="">Select Category...</option>
                  {categories?.map((cat:any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </FormField>
              <FormField label="Storage Location">
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none appearance-none">
                  <option value="">Select Warehouse...</option>
                  {warehouses?.map((w:any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Measurement Unit">
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none appearance-none">
                  <option value="Pcs">Pcs</option>
                  <option value="Kg">Kg</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Ltr">Ltr</option>
                </select>
              </FormField>
              <FormField label="Depletion Alert Level">
                <input type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none outline-none" />
              </FormField>
            </div>

            <div className="pt-8 flex gap-4">
              <button onClick={onClose} className="flex-1 py-6 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200">Cancel</button>
              <button
                onClick={() => onSubmit({ itemName, sku, unit, categoryId, warehouseId, minimumStock, quantity: '0' })}
                disabled={!itemName || !categoryId || !warehouseId || isPending}
                className="flex-[2] py-6 bg-slate-950 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-2xl transition-all"
              >
                Create Stock Record
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryConfigView({ categories, warehouses, queryClient }: any) {
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.INVENTORY.CATEGORIES, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      toast.success('Material Category Created');
    }
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.INVENTORY.WAREHOUSES, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] });
      toast.success('Warehouse Location Registered');
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Categories */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Material Categories</h3>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Tag className="w-6 h-6" /></div>
        </div>
        <div className="space-y-3">
          {categories?.map((cat: any) => (
            <div key={cat.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
              <span className="font-bold text-slate-700">{cat.name}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat.description || 'Master Component'}</span>
            </div>
          ))}
          <QuickAddForm 
            placeholder="New Category Name (e.g. Resins)" 
            onSubmit={(name) => createCategoryMutation.mutate({ name, description: 'Operational Category' })} 
          />
        </div>
      </div>

      {/* Warehouses */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Warehouse Locations</h3>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Building2 className="w-6 h-6" /></div>
        </div>
        <div className="space-y-3">
          {warehouses?.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
              <span className="font-bold text-slate-700">{w.name}</span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest">{w.type}</span>
            </div>
          ))}
          <QuickAddForm 
            placeholder="New Location (e.g. WH-B)" 
            onSubmit={(name) => createWarehouseMutation.mutate({ name, type: 'RAW_MATERIAL' })} 
          />
        </div>
      </div>
    </div>
  );
}

function QuickAddForm({ placeholder, onSubmit }: { placeholder: string; onSubmit: (val: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2 pt-4">
      <input 
        value={val} 
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 bg-slate-50 rounded-2xl px-6 py-4 text-sm font-bold border-2 border-transparent focus:border-indigo-600/10 outline-none" 
        placeholder={placeholder} 
      />
      <button 
        onClick={() => { if(val) { onSubmit(val); setVal(''); } }}
        className="p-4 bg-slate-950 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-lg"
      >
        <Plus className="w-5 h-5" />
      </button>
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
