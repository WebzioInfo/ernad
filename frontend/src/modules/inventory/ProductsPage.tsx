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

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-2xl" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Products Database...</p>
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
                Products Database
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-indigo-400 uppercase tracking-widest">Master Data</span>
              </h1>
              <p className="text-slate-400 font-bold mt-2 text-sm">Industrial product configurations and speed parameters.</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl transition-all whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            Register Product
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="Query products by SKU or Name..."
            className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-5 pl-16 pr-8 font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50/5 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
          {uniqueBrandNames.map(brand => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-8 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedBrand === brand
                ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]'
                : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                }`}
            >
              {brand}
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
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Target BPM</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredProducts?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-10 py-16 text-center text-sm font-bold text-slate-400 uppercase tracking-wider">
                      No products registered.
                    </td>
                  </tr>
                ) : (
                  filteredProducts?.map((product: any, idx: number) => {
                    const brandObj = brands?.find((b: any) => b.id === product.brandId);
                    return (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.03 }}
                        key={product.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-10 py-8 font-black text-slate-900 tracking-tight text-lg">
                          {product.name}
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{product.sku || 'NO-SKU'}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <span className="px-3 py-1 bg-indigo-50 border border-indigo-100/60 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-[0.1em]">
                            {brandObj?.name || 'Unknown Brand'}
                          </span>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{product.category || 'General'}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-center font-bold text-slate-700">
                          <div className="flex items-center justify-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{product.targetBPM} BPM</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-3">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setEditingProduct(product)}
                              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm cursor-pointer"
                              title="Edit Product"
                            >
                              <PenLine className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(product.id)}
                              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
        <div className="p-12">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8">
            {product ? 'Edit Product' : 'Register Product'}
          </h3>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({ name, sku, brandId, category, targetBPM: Number(targetBPM) });
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Product Commercial Name</label>
              <input 
                required 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 focus:bg-white outline-none transition-all text-slate-700" 
                placeholder="e.g. Kenby Water 500ml" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">SKU / Product Code</label>
              <input 
                required 
                value={sku} 
                onChange={(e) => setSku(e.target.value)} 
                className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 focus:bg-white outline-none transition-all text-slate-700" 
                placeholder="e.g. KB-WAT-500" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Brand</label>
                <select 
                  required 
                  value={brandId} 
                  onChange={(e) => setBrandId(e.target.value)} 
                  className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none outline-none text-slate-700"
                >
                  <option value="">Select Brand...</option>
                  {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Category</label>
                <input 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 focus:bg-white outline-none transition-all text-slate-700" 
                  placeholder="e.g. Water" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block font-extrabold">Target Speed (BPM)</label>
              <input 
                type="number" 
                required 
                value={targetBPM} 
                onChange={(e) => setTargetBPM(Number(e.target.value))} 
                className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 focus:bg-white outline-none transition-all text-slate-700" 
                placeholder="120"
              />
            </div>

            <div className="pt-8 flex gap-4">
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 py-6 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-[2] py-6 bg-slate-950 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {product ? 'Save Changes' : 'Register Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
