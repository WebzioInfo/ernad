import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../../constants/endpoints';
import { api } from '../../services/api-client';
import {
  Plus, Package,
  Search, Check, Loader2, Trash2, PenLine,
  Tag, Hash, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.PRODUCTS)).data,
    refetchInterval: 15000
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.BRANDS)).data,
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.MASTER_DATA.PRODUCTS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product registered successfully');
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create product');
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.patch(`${ENDPOINTS.MASTER_DATA.PRODUCTS}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      setEditingProduct(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update product');
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => 
      api.delete(`${ENDPOINTS.MASTER_DATA.PRODUCTS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const filteredProducts = products?.filter((p: any) => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    const brandObj = brands?.find((b: any) => b.id === p.brandId);
    const matchesBrand = selectedBrand === 'All' || brandObj?.name === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  const uniqueBrandNames = ['All', ...Array.from(new Set(brands?.map((b: any) => b.name) || [])) as string[]];

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9A91]" />
        <p className="font-semibold uppercase tracking-wider text-[10px]">Syncing Products Database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700 border border-slate-200">
              <Package className="w-5 h-5 text-[#1A9A91]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Products Database
            </h2>
            <span className="bg-slate-100 text-[#1A9A91] text-xs px-2 py-0.5 rounded-full border border-emerald-100 font-semibold">
              Master Data
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">Configure physical product parameters, custom SKU assignments, and target bottling speeds.</p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#1A9A91] hover:bg-[#157C75] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Register Product
        </button>
      </div>

      {/* Filters strip */}
      <div className="bg-white border border-slate-200 p-3 rounded-lg flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Query products by SKU or Name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {uniqueBrandNames.map(brand => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${
                selectedBrand === brand
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* List View (Table) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">Product Name</th>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Brand</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-center">Target BPM</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <AnimatePresence mode="popLayout">
                {filteredProducts?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No products registered matching current query filters.
                    </td>
                  </tr>
                ) : (
                  filteredProducts?.map((product: any, idx: number) => {
                    const brandObj = brands?.find((b: any) => b.id === product.brandId);
                    return (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                        key={product.id} 
                        className="hover:bg-slate-50/45 transition-colors group"
                      >
                        <td className="px-6 py-3.5 font-semibold text-slate-800 group-hover:text-[#1A9A91] transition-colors">
                          {product.name}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{product.sku || 'NO-SKU'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[#1A9A91] rounded text-[10px] font-semibold uppercase tracking-wide">
                            {brandObj?.name || 'Unknown Brand'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs text-slate-600 font-medium">{product.category || 'General'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{product.targetBPM} BPM</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className="p-1.5 text-slate-400 hover:text-[#1A9A91] hover:bg-slate-105 rounded-lg transition-colors"
                              title="Edit Product"
                            >
                              <PenLine className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-105 rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(isCreateModalOpen || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          brands={brands}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingProduct(null);
          }}
          onSubmit={(data: any) => {
            if (editingProduct) {
              updateProductMutation.mutate({ id: editingProduct.id, data });
            } else {
              createProductMutation.mutate(data);
            }
          }}
          isPending={createProductMutation.isPending || updateProductMutation.isPending}
        />
      )}
    </div>
  );
}

function ProductFormModal({ product, brands, onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [brandId, setBrandId] = useState(product?.brandId || '');
  const [category, setCategory] = useState(product?.category || '');
  const [targetBPM, setTargetBPM] = useState(product?.targetBPM || 120);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {product ? 'Modify Product Specifications' : 'Register New Product'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, sku, brandId, category, targetBPM: Number(targetBPM) });
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Product Commercial Name</label>
            <input 
              required 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" 
              placeholder="e.g. Kenby Water 500ml" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">SKU / Product Code</label>
            <input 
              required 
              value={sku} 
              onChange={(e) => setSku(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" 
              placeholder="e.g. KB-WAT-500" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Brand</label>
              <select 
                required 
                value={brandId} 
                onChange={(e) => setBrandId(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 text-sm font-medium outline-none text-slate-750 cursor-pointer"
              >
                <option value="">Select Brand...</option>
                {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Category</label>
              <input 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" 
                placeholder="e.g. Water" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Target Speed (BPM)</label>
            <input 
              type="number" 
              required 
              value={targetBPM} 
              onChange={(e) => setTargetBPM(Number(e.target.value))} 
              className="w-full bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#1A9A91] focus:bg-white transition-all outline-none" 
              placeholder="120"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-1.5 bg-slate-105 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-1.5 bg-[#1A9A91] hover:bg-[#157C75] text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {product ? 'Save Changes' : 'Register Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Inline fallback close indicator
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  );
}
