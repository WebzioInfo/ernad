import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api';
import { 
  Play, Square, RefreshCcw, MoreVertical, 
  Gauge, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductionTab({ filters }: { filters: any }) {
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/master-data/brands')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/master-data/products')).data });

  const { data: lines, isLoading } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => {
      const res = await api.get('/master-data/lines');
      return res.data;
    }
  });

  if (isLoading) return <div className="h-96 flex items-center justify-center text-slate-400">Loading factory floor map...</div>;

  const filteredLines = lines?.filter((l: any) => l.id === filters.lineId);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredLines?.map((line: any) => (
          <LineControlCard 
            key={line.id} 
            line={line} 
            filters={filters} 
            brands={brands} 
            products={products} 
          />
        ))}
      </div>
    </div>
  );
}



function LineControlCard({ line, brands, products }: any) {
  const queryClient = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  const startBatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBrand || !selectedProduct) throw new Error('Please select brand and product');
      return await api.post('/production-batch/start', {
        lineId: line.id,
        brandId: selectedBrand,
        productId: selectedProduct,
        shiftId: 'SHIFT_A' // Should be dynamic
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      toast.success('Production Batch Started');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to start batch');
    }
  });

  return (
    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.25rem] flex items-center justify-center">
            <Gauge className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{line.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${line.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{line.status}</span>
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
          <MoreVertical className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        {line.status === 'IDLE' ? (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <select 
                  value={selectedBrand} 
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700"
                >
                  <option value="">Select Brand</option>
                  {brands?.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select 
                  value={selectedProduct} 
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-700"
                >
                  <option value="">Select Product SKU</option>
                  {products?.filter((p:any) => p.brandId === selectedBrand).map((p:any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Batch</p>
              <p className="text-sm font-black text-slate-900">#BTCH-RUNNING</p>
            </div>
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</p>
              <p className="text-sm font-black text-slate-900">Active SKU</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {line.status === 'IDLE' ? (
          <button 
            onClick={() => startBatchMutation.mutate()}
            disabled={startBatchMutation.isPending}
            className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {startBatchMutation.isPending ? <Loader2 className="animate-spin" /> : <Play className="w-4 h-4 fill-white" />} 
            Start Production
          </button>
        ) : (
          <>
            <button className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all">
              <Square className="w-4 h-4 fill-white" /> Stop Batch
            </button>
            <button className="flex-1 bg-amber-50 text-amber-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-100 transition-all border border-amber-100">
              <RefreshCcw className="w-4 h-4" /> Changeover
            </button>
          </>
        )}
      </div>
    </div>
  );
}
