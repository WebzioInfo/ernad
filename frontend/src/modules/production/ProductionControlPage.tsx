import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { 
  Activity, Play, Square, RefreshCcw, MoreVertical, 
  Gauge, Loader2, X, Users, BarChart2,
  Clock, ArrowLeft, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProductionControlPage() {
  const { filters, setFilters } = useOutletContext<{ filters: any; setFilters: (f: any) => void }>();

  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: async () => (await api.get('/master-data/brands')).data });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/master-data/products')).data });
  const { data: shifts } = useQuery({ queryKey: ['shifts'], queryFn: async () => (await api.get('/master-data/shifts')).data });
  
  const { data: lines, isLoading } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data,
    refetchInterval: 15000,
  });

  if (isLoading) return (
    <div className="h-96 flex items-center justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading lines...
    </div>
  );

  const isFiltered = filters?.lineId && filters.lineId !== 'all';
  const focusedLine = lines?.find((l: any) => l.id === filters.lineId);

  if (isFiltered && focusedLine) {
    return (
      <ProductionCommander 
        line={focusedLine} 
        onBack={() => setFilters({ lineId: 'all' })}
        brands={brands}
        products={products}
        shifts={shifts}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Production Floor</h2>
           <p className="text-slate-500 font-medium">Monitoring {lines?.length || 0} active lines.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
              {lines?.filter((l:any)=>l.status==='RUNNING').length} Active
           </div>
           <div className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
              {lines?.filter((l:any)=>l.status==='IDLE').length} Idle
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {lines?.map((line: any) => (
          <LineControlCard
            key={line.id}
            line={line}
            onFocus={() => setFilters({ lineId: line.id })}
            brands={brands}
            products={products}
            shifts={shifts}
          />
        ))}
      </div>
    </div>
  );
}

function ProductionCommander({ line, onBack, brands, products, shifts }: any) {
   console.log("LINE DATA (COMMANDER):", line);
   console.log("BATCH DATA:", line.batch);

  const { data: stats } = useQuery({
    queryKey: ['line-performance-detail', line.id],
    queryFn: async () => (await api.get('/analytics/line-performance', { params: { lineId: line.id } })).data,
    refetchInterval: 5000
  });

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="w-14 h-14 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl flex items-center justify-center transition-all group">
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
               <h2 className="text-3xl font-black text-slate-900 tracking-tight">{line.name}</h2>
               <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                 line.status === 'RUNNING' ? 'bg-emerald-500 text-white animate-pulse' : 
                 line.status === 'CHANGEOVER' ? 'bg-amber-500 text-white animate-pulse' : 
                 'bg-slate-300 text-white'
               }`}>
                 {line.status}
               </span>
            </div>
            <p className="text-slate-500 font-medium mt-1">{line.description || 'Enterprise production unit.'}</p>
          </div>
        </div>

         <div className="flex items-center gap-4">
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Batch</p>
               <p className="text-lg font-black text-slate-900 leading-tight">{line.batch?.batchCode || 'NO BATCH'}</p>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{line.batch?.productName || 'No Active Product'}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
               {line.batch?.batchCode?.charAt(0) || '?'}
            </div>
         </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-8">
         <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <TelemetryCard label="Efficiency" value={`${stats?.oee || 0}%`} icon={Gauge} color="indigo" sub="OEE" />
               <TelemetryCard label="Speed" value={`${Math.round(stats?.bpm || 0)}`} icon={Activity} color="emerald" sub="BPM" />
               <TelemetryCard label="Operators" value={`${stats?.activeOperators || 0}`} icon={Users} color="blue" sub="On Line" />
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
               <div className="absolute top-0 right-0 p-10 opacity-10">
                  <BarChart2 className="w-40 h-40" />
               </div>
               <div className="relative z-10">
                  <div className="flex justify-between items-center mb-10">
                     <h3 className="text-2xl font-black tracking-tight">Output</h3>
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
                        <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-xs font-black">
                           {stats?.stats?.find((s:any)=>s.station==='PACKING')?.total || 0} Units
                        </div>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-6">
                     {['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map((station) => {
                       const sData = stats?.stats?.find((s:any) => s.station === station);
                       return (
                         <div key={station} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:bg-white/10 transition-all">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{station}</p>
                            <p className="text-2xl font-black">{sData?.total || 0}</p>
                            <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                               <div className="h-full bg-indigo-500" style={{ width: `${Math.min(((sData?.total||0)/5000)*100, 100)}%` }} />
                            </div>
                         </div>
                       );
                     })}
                  </div>
               </div>
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Station Control</h3>
                <div className="space-y-4">
                   <LineControlButtons line={line} brands={brands} products={products} shifts={shifts} />
                </div>
            </div>
            
            <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-20">
                  <Clock className="w-20 h-20" />
               </div>
               <h3 className="text-xl font-black mb-4 relative z-10">Time Left</h3>
               <div className="text-4xl font-black tracking-tighter mb-6 relative z-10">02:44:12</div>
               <p className="text-indigo-100 text-sm font-bold relative z-10 leading-relaxed mb-8">
                  Production target is 82% complete. Estimated completion time: 04:15 PM.
               </p>
               <div className="h-2 bg-white/20 rounded-full overflow-hidden relative z-10">
                  <div className="h-full bg-white w-[82%]" />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function TelemetryCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all">
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
         color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
         color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
         'bg-blue-50 text-blue-600'
       }`}>
         <Icon className="w-6 h-6" />
       </div>
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <div className="flex items-baseline gap-2">
          <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sub}</span>
       </div>
    </div>
  );
}

function LineControlButtons({ line, brands, products, shifts }: any) {
  const queryClient = useQueryClient();
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [stopRemarks, setStopRemarks] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [stopEndTime, setStopEndTime] = useState(new Date().toISOString().slice(0, 16));
  const [changeoverModalOpen, setChangeoverModalOpen] = useState(false);
  const [changeoverBrand, setChangeoverBrand] = useState('');
  const [changeoverProduct, setChangeoverProduct] = useState('');
  const [materialReturns, setMaterialReturns] = useState<any>({ preforms: 0, caps: 0, labels: 0 });

   const invalidate = () => {
     queryClient.invalidateQueries({ queryKey: ['production-lines'] });
   };

  const startMutation = useMutation({
    mutationFn: () => api.post(`/production/start`, {
      lineId: line.id,
      shiftId: selectedShift,
      brandId: selectedBrand,
      productId: selectedProduct,
      batchCode: batchCode || undefined,
      remarks,
      startTime: new Date(startTime).toISOString()
    }),
    onSuccess: () => { 
      invalidate(); 
      toast.success('Production started'); 
    }
  });

  const stopMutation = useMutation({
    mutationFn: () => {
      if (!line.batch?.id) {
        toast.error('No active batch found to close');
        throw new Error('No active batch ID');
      }
      return api.put(`/production/${line.batch.id}/close`, { 
        remarks: stopRemarks,
        endTime: new Date(stopEndTime).toISOString(),
        materialReturn: materialReturns
      });
    },
    onSuccess: () => { 
      invalidate(); 
      setStopConfirmOpen(false); 
      toast.success('Production moved to QC_PENDING'); 
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Stop failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  const changeoverMutation = useMutation({
    mutationFn: () => api.post(`/production/line/${line.id}/changeover`, { 
      productId: changeoverProduct,
      batchId: line.batch?.id
    }),
    onSuccess: () => { invalidate(); setChangeoverModalOpen(false); toast.success('Changeover initiated'); },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message;
      toast.error(`Changeover failed: ${Array.isArray(msg) ? msg[0] : msg}`);
    }
  });

  if (line.status === 'IDLE') {
    return (
      <StartProductionForm 
        shifts={shifts} 
        brands={brands} 
        products={products} 
        selectedShift={selectedShift} setSelectedShift={setSelectedShift}
        selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand}
        selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct}
        batchCode={batchCode} setBatchCode={setBatchCode}
        startTime={startTime} setStartTime={setStartTime}
        remarks={remarks} setRemarks={setRemarks}
        onSubmit={() => startMutation.mutate()}
        isPending={startMutation.isPending}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <button 
        onClick={() => setStopConfirmOpen(true)} 
        disabled={!line.batch || stopMutation.isPending}
        className="flex flex-col items-center gap-3 p-8 bg-slate-900 text-white rounded-[2.5rem] hover:bg-black transition-all group disabled:opacity-50"
      >
         {stopMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-6 h-6 fill-white group-hover:scale-110 transition-transform" />}
         <span className="text-[10px] font-black uppercase tracking-widest">
           {stopMutation.isPending ? 'Closing...' : 'End Batch'}
         </span>
      </button>
      <button onClick={() => setChangeoverModalOpen(true)} className="flex flex-col items-center gap-3 p-8 bg-amber-500 text-white rounded-[2.5rem] hover:bg-amber-600 transition-all group">
         <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
         <span className="text-[10px] font-black uppercase tracking-widest">Changeover</span>
      </button>
      
      {stopConfirmOpen && (
        <Modal onClose={() => setStopConfirmOpen(false)}>
           <div className="text-center mb-8">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                 <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Finalize Production?</h3>
              <p className="text-slate-500 font-medium mt-2">Closing batch will trigger inventory deduction and move state to QC Pending.</p>
           </div>

           <div className="mb-4">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1">Ending Time</label>
             <input 
               type="datetime-local" 
               value={stopEndTime} 
               onChange={(e) => setStopEndTime(e.target.value)}
               className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
             />
           </div>

           <textarea 
             value={stopRemarks} 
             onChange={(e) => setStopRemarks(e.target.value)}
             placeholder="End of shift remarks (optional)..."
             className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-24 resize-none mb-6"
           />

           <div className="bg-slate-50 p-6 rounded-[2rem] mb-8">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Material Returns</h4>
              <div className="grid grid-cols-3 gap-4">
                 {Object.keys(materialReturns).map(key => (
                   <div key={key}>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 capitalize">{key}</label>
                      <input 
                         type="number" 
                         value={materialReturns[key]} 
                         onChange={(e) => setMaterialReturns({...materialReturns, [key]: Number(e.target.value)})}
                         className="w-full bg-white border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                   </div>
                 ))}
              </div>
           </div>
           <div className="flex gap-4">
              <button onClick={() => setStopConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
              <button onClick={() => stopMutation.mutate()} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-200">Confirm Close</button>
           </div>
        </Modal>
      )}

      {changeoverModalOpen && (
        <Modal onClose={() => setChangeoverModalOpen(false)}>
           <h3 className="text-xl font-black mb-4">Product Changeover</h3>
           <p className="text-slate-500 mb-6">Select the next brand and product to be produced on this line.</p>
           
           <div className="space-y-4 mb-8">
             <select value={changeoverBrand} onChange={(e) => { setChangeoverBrand(e.target.value); setChangeoverProduct(''); }} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4">
                <option value="">Select Brand</option>
                {brands?.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
             
             <select 
               value={changeoverProduct} 
               onChange={(e) => setChangeoverProduct(e.target.value)} 
               className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 disabled:opacity-50"
               disabled={!changeoverBrand}
             >
                <option value="">Select New Product</option>
                {products?.filter((p:any) => p.brandId === changeoverBrand).map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
           </div>
           <div className="flex gap-4">
              <button onClick={() => setChangeoverModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
              <button onClick={() => changeoverMutation.mutate()} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-100">Initiate</button>
           </div>
        </Modal>
      )}
    </div>
  );
}

function StartProductionForm({ 
  shifts, brands, products, 
  selectedShift, setSelectedShift, 
  selectedBrand, setSelectedBrand, 
  selectedProduct, setSelectedProduct,
  batchCode, setBatchCode,
  startTime, setStartTime,
  remarks, setRemarks,
  onSubmit, isPending
}: any) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Shift Configuration</label>
         <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
           <option value="">Select Shift</option>
           {shifts?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
         </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
         <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Brand</label>
            <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
              <option value="">Select Brand</option>
              {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
         </div>
         <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Product</label>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
              <option value="">Select Product</option>
              {products?.filter((p:any)=>p.brandId === selectedBrand).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
         </div>
      </div>

      <div className="space-y-1">
         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Batch Number (Auto-gen if empty)</label>
         <input 
            type="text" 
            placeholder="e.g. NB-20260505-001" 
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700"
         />
      </div>

      <div className="space-y-1">
         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Time</label>
         <input 
            type="datetime-local" 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700"
         />
      </div>

      <textarea 
        value={remarks} 
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Shift remarks (optional)..."
        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-20 resize-none"
      />
      <button 
         onClick={onSubmit} 
         disabled={!selectedProduct || !selectedShift || isPending} 
         className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
      >
         {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
         Commit Production Start
      </button>
    </div>
  );
}

function LineControlCard({ line, onFocus, brands, products, shifts }: any) {
  const queryClient = useQueryClient();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  
  // Form State
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));



  const startMutation = useMutation({
    mutationFn: () => api.post(`/production/start`, {
      lineId: line.id,
      shiftId: selectedShift,
      brandId: selectedBrand,
      productId: selectedProduct,
      batchCode: batchCode || undefined,
      remarks,
      startTime: new Date(startTime).toISOString()
    }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['production-lines'] });
      setIsStartModalOpen(false);
      toast.success('Production started successfully'); 
    }
  });

   console.log("LINE DATA (CARD):", line);
   return (
     <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start mb-8">
          <div onClick={onFocus} className="flex items-center gap-5 cursor-pointer">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.25rem] flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Gauge className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{line.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${
                  line.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
                  line.status === 'CHANGEOVER' ? 'bg-amber-500 animate-pulse' :
                  line.status === 'MAINTENANCE' ? 'bg-rose-500' :
                  'bg-slate-300'
                }`} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {line.status}
                </span>
              </div>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
         <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-black text-slate-900 capitalize">{line.status.toLowerCase()}</p>
         </div>
          <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch</p>
            <p className="text-sm font-black text-slate-900 truncate">{line.batch?.batchCode || 'NO BATCH'}</p>
          </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onFocus} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2">
           Commander Interface <MoreVertical className="w-3 h-3" />
        </button>
        {line.status === 'IDLE' && (
          <button onClick={() => setIsStartModalOpen(true)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
             <Play className="w-3 h-3 fill-white" /> Start
          </button>
        )}
      </div>

      {isStartModalOpen && (
        <Modal onClose={() => setIsStartModalOpen(false)}>
           <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Quick Start: {line.name}</h3>
              <p className="text-slate-500 font-medium mt-1">Configure and launch a new production batch.</p>
           </div>
           <StartProductionForm 
             shifts={shifts} 
             brands={brands} 
             products={products} 
             selectedShift={selectedShift} setSelectedShift={setSelectedShift}
             selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand}
             selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct}
             batchCode={batchCode} setBatchCode={setBatchCode}
             startTime={startTime} setStartTime={setStartTime}
             remarks={remarks} setRemarks={setRemarks}
             onSubmit={() => startMutation.mutate()}
             isPending={startMutation.isPending}
           />
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
       <div className="bg-white rounded-[3rem] p-12 max-w-xl w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
          <button onClick={onClose} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
             <X className="w-6 h-6" />
          </button>
          {children}
       </div>
    </div>
  );
}
