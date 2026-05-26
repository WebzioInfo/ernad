import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../../constants/endpoints';
import { api } from '../../services/api-client';
import {
  Plus, Layers, Search, Check, Loader2, Trash2, PenLine,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function RawMaterialsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: rawMaterials, isLoading } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.RAW_MATERIALS)).data,
    refetchInterval: 15000
  });

  const { data: categories } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.CATEGORIES)).data,
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => api.post(ENDPOINTS.MASTER_DATA.RAW_MATERIALS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material registered successfully');
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create raw material');
    }
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.patch(`${ENDPOINTS.MASTER_DATA.RAW_MATERIALS}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material updated successfully');
      setEditingMaterial(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update raw material');
    }
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => 
      api.delete(`${ENDPOINTS.MASTER_DATA.RAW_MATERIALS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete raw material');
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this raw material?')) {
      deleteMaterialMutation.mutate(id);
    }
  };

  const filteredMaterials = rawMaterials?.filter((m: any) => {
    const matchesSearch = (m.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategoryNames = ['All', ...Array.from(new Set(categories?.map((c: any) => c.name) || [])) as string[]];

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-2xl" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Materials Database...</p>
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
              <Layers className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                Raw Materials
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-indigo-400 uppercase tracking-widest">Master Data</span>
              </h1>
              <p className="text-slate-400 font-bold mt-2 text-sm">Industrial resource categories and specific material registry.</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl transition-all whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            Register Material
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="Query raw materials by Name..."
            className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-5 pl-16 pr-8 font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50/5 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
          {uniqueCategoryNames.map(cat => (
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
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Name</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredMaterials?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-10 py-16 text-center text-sm font-bold text-slate-400 uppercase tracking-wider">
                      No raw materials registered.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials?.map((material: any, idx: number) => {
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
                        <td className="px-10 py-8 font-black text-slate-900 tracking-tight text-lg">
                          {material.name}
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span className="px-3 py-1 bg-slate-900/5 text-slate-650 rounded-lg text-[9px] font-black uppercase tracking-[0.1em]">
                              {material.categoryName || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-3">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setEditingMaterial(material)}
                              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm cursor-pointer"
                              title="Edit Material"
                            >
                              <PenLine className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(material.id)}
                              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                              title="Delete Material"
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
      {(isCreateModalOpen || editingMaterial) && (
        <MaterialFormModal
          material={editingMaterial}
          categories={categories}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingMaterial(null);
          }}
          onSubmit={(data: any) => {
            if (editingMaterial) {
              updateMaterialMutation.mutate({ id: editingMaterial.id, data });
            } else {
              createMaterialMutation.mutate(data);
            }
          }}
          isPending={createMaterialMutation.isPending || updateMaterialMutation.isPending}
        />
      )}
    </div>
  );
}

function MaterialFormModal({ material, categories, onClose, onSubmit, isPending }: any) {
  const [name, setName] = useState(material?.name || '');
  const [categoryId, setCategoryId] = useState(material?.categoryId || '');

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
        <div className="p-12">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8">
            {material ? 'Edit Material' : 'Register Material'}
          </h3>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({ name, categoryId });
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Material Commercial Name</label>
              <input 
                required 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-2 border-transparent focus:border-indigo-600/20 focus:bg-white outline-none transition-all text-slate-700" 
                placeholder="e.g. Preform 24g Blue" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Category</label>
              <select 
                required 
                value={categoryId} 
                onChange={(e) => setCategoryId(e.target.value)} 
                className="w-full bg-slate-50 rounded-2xl px-6 py-5 font-bold border-none outline-none text-slate-700"
              >
                <option value="">Select Category...</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
                {material ? 'Save Changes' : 'Register Material'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
