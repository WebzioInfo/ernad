import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { 
  Plus, Package, Tag, Edit2, Trash2, 
  Layers, Box, HardDrive, X, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import useAuthStore from '../../store/useAuthStore';

export default function FactoryConfigurationPage() {
  const [activeSubTab, setActiveSubTab] = useState<'brands' | 'products' | 'raw-materials' | 'shifts' | 'lines'>('brands');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });
  const queryClient = useQueryClient();

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get('/master-data/brands')).data
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/master-data/products')).data
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => (await api.get('/master-data/raw-materials')).data
  });

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => (await api.get('/master-data/shifts')).data
  });
  
  const { data: lines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  const { data: factories } = useQuery({
    queryKey: ['factories'],
    queryFn: async () => (await api.get('/master-data/factories')).data
  });

  const createBrandMutation = useMutation({
    mutationFn: (name: string) => api.post('/master-data/brands', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand created successfully');
      setIsModalOpen(false);
    }
  });

  const updateBrandMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch(`/master-data/brands/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand updated successfully');
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/master-data/brands/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand deleted successfully');
    }
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post('/master-data/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
      setIsModalOpen(false);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/master-data/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/master-data/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
    }
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => api.post('/master-data/raw-materials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Material added successfully');
      setIsModalOpen(false);
    }
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/master-data/raw-materials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Material updated successfully');
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/master-data/raw-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Material deleted successfully');
    }
  });

  const createShiftMutation = useMutation({
    mutationFn: (data: any) => api.post('/master-data/shifts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift created successfully');
      setIsModalOpen(false);
    }
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/master-data/shifts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift updated successfully');
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/master-data/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift deleted successfully');
    }
  });

  const createLineMutation = useMutation({
    mutationFn: (data: any) => api.post('/master-data/lines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      toast.success('Production line created successfully');
      setIsModalOpen(false);
    }
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/master-data/lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      toast.success('Production line updated successfully');
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const deleteLineMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/master-data/lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      toast.success('Production line deleted successfully');
    }
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirmation({ isOpen: true, id, name });
  };

  const executeDelete = () => {
    const { id } = deleteConfirmation;
    if (activeSubTab === 'brands') deleteBrandMutation.mutate(id);
    else if (activeSubTab === 'products') deleteProductMutation.mutate(id);
    else if (activeSubTab === 'raw-materials') deleteMaterialMutation.mutate(id);
    else if (activeSubTab === 'lines') deleteLineMutation.mutate(id);
    else deleteShiftMutation.mutate(id);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ConfirmationModal 
        isOpen={deleteConfirmation.isOpen}
        title="Remove Master Data"
        message={`Are you sure you want to delete "${deleteConfirmation.name}"? This will affect all associated production records.`}
        confirmText="Confirm Deletion"
        onClose={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
        onConfirm={executeDelete}
      />
      {/* Header & Control Center */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-100/10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <Layers className="w-10 h-10 text-indigo-600" />
            Master Data Engine
          </h2>
          <p className="text-slate-500 font-medium mt-2">Configure core factory assets, product lineages, and operational shifts.</p>
        </div>
        
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[1.5rem] font-black flex items-center gap-3 shadow-2xl shadow-indigo-200 transition-all active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-6 h-6" />
          Add {activeSubTab === 'brands' ? 'Brand' : activeSubTab === 'products' ? 'Product' : activeSubTab === 'raw-materials' ? 'Material' : activeSubTab === 'lines' ? 'Line' : 'Shift'}
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-[2rem] border border-slate-100 w-full max-w-4xl">
        {[
          { id: 'brands', label: 'Brand Portfolio', icon: Tag },
          { id: 'products', label: 'Product Catalog', icon: Package },
          { id: 'raw-materials', label: 'Material Ledger', icon: HardDrive },
          { id: 'shifts', label: 'Operational Shifts', icon: Clock },
          { id: 'lines', label: 'Production Lines', icon: Layers }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all ${
              activeSubTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100/50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeSubTab === tab.id ? 'text-indigo-600' : 'text-slate-300'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeSubTab === 'brands' && brands?.map((brand: any) => (
          <BrandCard 
            key={brand.id} 
            brand={brand} 
            onEdit={() => handleEdit(brand)} 
            onDelete={() => handleDelete(brand.id, brand.name)}
          />
        ))}
        {activeSubTab === 'products' && products?.map((product: any) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onEdit={() => handleEdit(product)}
            onDelete={() => handleDelete(product.id, product.name)}
          />
        ))}
        {activeSubTab === 'raw-materials' && rawMaterials?.map((material: any) => (
          <RawMaterialCard 
            key={material.id} 
            material={material} 
            onEdit={() => handleEdit(material)}
            onDelete={() => handleDelete(material.id, material.name)}
          />
        ))}
        {activeSubTab === 'shifts' && shifts?.map((shift: any) => (
          <ShiftCard 
            key={shift.id} 
            shift={shift} 
            onEdit={() => handleEdit(shift)}
            onDelete={() => handleDelete(shift.id, shift.name)}
          />
        ))}
        {activeSubTab === 'lines' && lines?.map((line: any) => (
          <LineCard 
            key={line.id} 
            line={line} 
            onEdit={() => handleEdit(line)}
            onDelete={() => handleDelete(line.id, line.name)}
          />
        ))}
      </div>

      {isModalOpen && (
        <MasterDataModal 
          type={activeSubTab} 
          brands={brands}
          factories={factories}
          initialData={editingItem}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }} 
          onSubmit={(data: any) => {
            if (activeSubTab === 'brands') {
              if (editingItem) updateBrandMutation.mutate({ id: editingItem.id, name: data.name });
              else createBrandMutation.mutate(data.name);
            } else if (activeSubTab === 'products') {
              if (editingItem) updateProductMutation.mutate({ id: editingItem.id, ...data });
              else createProductMutation.mutate(data);
            } else if (activeSubTab === 'raw-materials') {
              if (editingItem) updateMaterialMutation.mutate({ id: editingItem.id, ...data });
              else createMaterialMutation.mutate(data);
            } else if (activeSubTab === 'lines') {
              if (editingItem) updateLineMutation.mutate({ id: editingItem.id, ...data });
              else createLineMutation.mutate(data);
            } else {
              if (editingItem) updateShiftMutation.mutate({ id: editingItem.id, ...data });
              else createShiftMutation.mutate(data);
            }
          }}
        />
      )}
    </div>
  );
}

function BrandCard({ brand, onEdit, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl">
          {brand.name.charAt(0)}
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-black text-slate-900 text-lg mb-1">{brand.name}</h4>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Brand</p>
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <Box className="w-6 h-6" />
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-black text-slate-900 text-lg mb-1">{product.name}</h4>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100">
          {product.sku}
        </span>
        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">
          {product.category}
        </span>
      </div>
    </div>
  );
}

function RawMaterialCard({ material, onEdit, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
          <HardDrive className="w-6 h-6" />
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-black text-slate-900 text-lg mb-1">{material.name}</h4>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100">
          {material.currentStock} {material.unit}
        </span>
        <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-100">
          Min: {material.minimumStock}
        </span>
      </div>
    </div>
  );
}

function ShiftCard({ shift, onEdit, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
          <Clock className="w-6 h-6" />
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-amber-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-black text-slate-900 text-lg mb-1">{shift.name}</h4>
      <div className="flex items-center gap-2 mt-3">
        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-black">
          {shift.startTime} - {shift.endTime}
        </span>
      </div>
    </div>
  );
}

function LineCard({ line, onEdit, onDelete }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
          <Layers className="w-6 h-6" />
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="font-black text-slate-900 text-lg mb-1">{line.name}</h4>
      <p className="text-sm font-medium text-slate-400 mt-2 line-clamp-2">
        {line.description || 'Primary production line unit.'}
      </p>
    </div>
  );
}

function MasterDataModal({ type, brands, factories, initialData, onClose, onSubmit }: any) {
  const { user } = useAuthStore();
  const [name, setName] = useState(initialData?.name || '');
  const [sku, setSku] = useState(initialData?.sku || '');
  const [brandId, setBrandId] = useState(initialData?.brandId || brands?.[0]?.id || '');
  const [category, setCategory] = useState(initialData?.category || (type === 'raw-materials' ? 'Packaging' : 'Water'));
  const [unit, setUnit] = useState(initialData?.unit || 'Pcs');
  const [minStock, setMinStock] = useState(initialData?.minimumStock || '0');
  const [startTime, setStartTime] = useState(initialData?.startTime || '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '16:00');
  const [description, setDescription] = useState(initialData?.description || '');
  const [factoryId, setFactoryId] = useState(initialData?.factoryId || user?.factoryId || (factories?.[0]?.id || ''));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {initialData ? 'Edit' : 'Add New'} {type === 'brands' ? 'Brand' : type === 'products' ? 'Product' : type === 'raw-materials' ? 'Material' : type === 'lines' ? 'Line' : 'Shift'}
            </h3>
            <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            {user?.role === 'SUPER_ADMIN' && !initialData && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Assign to Factory</label>
                <select 
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                  value={factoryId}
                  onChange={(e) => setFactoryId(e.target.value)}
                >
                  <option value="">Select a factory</option>
                  {factories?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Name</label>
              <input 
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder={type === 'brands' ? "e.g. Kenby" : type === 'shifts' ? "e.g. Morning" : "e.g. Kenby 1L"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {type === 'products' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">SKU Code</label>
                  <input 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder="KEN-1L"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Brand</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                  >
                    {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Category</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Water">Water</option>
                    <option value="Soda">Soda</option>
                    <option value="Juice">Juice</option>
                  </select>
                </div>
              </>
            )}

            {type === 'raw-materials' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Unit</label>
                    <select 
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Kg">Kg</option>
                      <option value="Ltr">Ltr</option>
                      <option value="Rolls">Rolls</option>
                      <option value="Bags">Bags</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Min. Stock</label>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Category</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Packaging">Packaging</option>
                    <option value="Closure">Closure</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Ingredients">Ingredients</option>
                  </select>
                </div>
              </>
            )}

            {type === 'shifts' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Start Time</label>
                  <input 
                    type="time"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">End Time</label>
                  <input 
                    type="time"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            {type === 'lines' && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                <textarea 
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-100 transition-all min-h-[100px]"
                  placeholder="Operational details of the production line..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            <div className="pt-6 flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!name) return;
                  const data: any = { name, factoryId };
                  if (type === 'products') {
                    if (!brandId && brands?.length > 0) {
                      toast.error('Please select a brand');
                      return;
                    }
                    data.sku = sku;
                    data.brandId = brandId || (brands?.length > 0 ? brands[0].id : null);
                    data.category = category;
                  } else if (type === 'raw-materials') {
                    data.unit = unit;
                    data.minimumStock = minStock;
                    data.category = category;
                  } else if (type === 'shifts') {
                    data.startTime = startTime;
                    data.endTime = endTime;
                  } else if (type === 'lines') {
                    data.description = description;
                  }
                  onSubmit(data);
                }}
                disabled={!name}
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"
              >
                {initialData ? 'Update' : 'Save'} {type === 'brands' ? 'Brand' : type === 'products' ? 'Product' : type === 'raw-materials' ? 'Material' : type === 'lines' ? 'Line' : 'Shift'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



