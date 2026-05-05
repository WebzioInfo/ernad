import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { api } from '../../api';
import { 
  Activity, Play, Square, RefreshCcw, MoreVertical, 
  Gauge, Loader2, Pencil, Trash2, X, Check, AlertTriangle,
  History, Users, BarChart2, TrendingUp,
  Clock, Shield, ArrowLeft, Wrench, Construction, ShieldAlert, ZapOff
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProductionControlPage() {
  const { filters, setFilters } = useOutletContext<{ filters: any; setFilters: (f: any) => void }>();
  const { user } = useAuthStore();

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
        canManage={user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER'}
      />
    );
  }

  const filteredLines = lines; // Showing all lines when not filtered

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lines</h2>
           <p className="text-slate-500 font-medium">Managing {lines?.length || 0} lines.</p>
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
        {filteredLines?.map((line: any) => (
          <LineControlCard
            key={line.id}
            line={line}
            brands={brands}
            products={products}
            shifts={shifts}
            canManage={user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER'}
            userId={user?.id}
            isFocused={false}
            onFocus={() => setFilters({ lineId: line.id })}
          />
        ))}
      </div>
    </div>
  );
}

function ProductionCommander({ line, onBack, brands, products, shifts }: any) {

  
  const { data: activeBatch } = useQuery({
    queryKey: ['active-batch', line.id],
    queryFn: async () => (await api.get(`/production/active/${line.id}`)).data,
    enabled: !!line.id,
    refetchInterval: 10000
  });

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
              <p className="text-lg font-black text-slate-900">{activeBatch?.batchCode || 'NO BATCH'}</p>
           </div>
           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
              {activeBatch?.product?.name.charAt(0) || '?'}
           </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-12 gap-8">
         {/* Left Column: Real-time Telemetry */}
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
                     {stats?.stats?.map((s:any) => (
                       <div key={s.station} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:bg-white/10 transition-all">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{s.station}</p>
                          <p className="text-2xl font-black">{s.total}</p>
                          <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                             <div className="h-full bg-indigo-500" style={{ width: `${Math.min((s.total/5000)*100, 100)}%` }} />
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Tips</h3>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Active</span>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                     <div className="flex items-center gap-3 mb-4">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-black text-slate-900">Efficiency Tip</h4>
                     </div>
                     <p className="text-sm font-medium text-slate-500 leading-relaxed">
                        Based on current BPM trends, shift completion is estimated at 04:30 PM. 
                        A 5% increase in throughput is possible by optimizing Labeling station buffer.
                     </p>
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                     <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        <h4 className="font-black text-slate-900">Quality Assurance</h4>
                     </div>
                     <p className="text-sm font-medium text-slate-500 leading-relaxed">
                        Rejection rate is exceptionally low (0.2%). Material consistency from current batch 
                        is optimal. Suggesting maintenance check for Filling station in 72 operating hours.
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* Right Column: Controls & Team */}
         <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
               <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Station Control</h3>
                <div className="space-y-4">
                   <LineControlButtons line={line} activeBatch={activeBatch} brands={brands} products={products} shifts={shifts} />
                </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Current Team</h3>
                  <Users className="w-5 h-5 text-slate-400" />
               </div>
               <div className="space-y-6">
                  {/* Mock personnel for demonstration of rich UI */}
                  {[
                    { name: 'John Doe', role: 'Blowing Specialist', status: 'On-Station', avatar: 'JD' },
                    { name: 'Sarah Smith', role: 'Filling Supervisor', status: 'On-Station', avatar: 'SS' },
                    { name: 'Marcus Rod', role: 'Labeling Tech', status: 'Monitoring', avatar: 'MR' },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center font-black text-sm">
                          {p.avatar}
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-black text-slate-900">{p.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.role}</p>
                       </div>
                       <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                          {p.status}
                       </div>
                    </div>
                  ))}
               </div>
               <button className="w-full mt-10 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Manage Team
               </button>
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

function LineControlButtons({ line, activeBatch: propActiveBatch, brands, products, shifts }: any) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [changeoverModalOpen, setChangeoverModalOpen] = useState(false);
  const [changeoverProduct, setChangeoverProduct] = useState('');
  const [remarks, setRemarks] = useState('');
  const [stopRemarks, setStopRemarks] = useState('');

  // Backdated start state
  const [useManualTime, setUseManualTime] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState(new Date().toTimeString().slice(0, 5));

  // If activeBatch is not passed, use the one from the line object (though it might be stale)
  const activeBatch = propActiveBatch || line.activeBatch;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-lines'] });
  };

  const startMutation = useMutation({
    mutationFn: () => {
      let startTime = undefined;
      if (useManualTime) {
         startTime = new Date(`${manualDate}T${manualTime}:00`).toISOString();
      }
      return api.post(`/production/start`, {
        factoryId: line.factoryId,
        lineId: line.id,
        shiftId: selectedShift,
        brandId: selectedBrand,
        productId: selectedProduct,
        createdBy: user?.id,
        remarks: remarks,
        startTime
      });
    },
    onSuccess: () => { 
      invalidate(); 
      setUseManualTime(false);
      toast.success('Production started'); 
    }
  });

  const stopMutation = useMutation({
    mutationFn: () => api.put(`/production/${activeBatch.id}/close`, { remarks: stopRemarks }),
    onSuccess: () => { 
      invalidate(); 
      setStopConfirmOpen(false); 
      setStopRemarks('');
      toast.success('Production stopped'); 
    }
  });

  const changeoverMutation = useMutation({
    mutationFn: () => api.post(`/production/line/${line.id}/changeover`, { 
      productId: changeoverProduct,
      batchId: activeBatch?.id
    }),
    onSuccess: () => { invalidate(); setChangeoverModalOpen(false); toast.success('Changeover complete'); }
  });

  if (line.status === 'IDLE') {
    return (
      <div className="space-y-4">
        <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
          <option value="">Select Shift</option>
          {shifts?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
          <option value="">Select Brand</option>
          {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
          <option value="">Select Product</option>
          {products?.filter((p:any)=>p.brandId === selectedBrand).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="pt-2">
           <button 
             onClick={() => setUseManualTime(!useManualTime)}
             className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-3 transition-colors ${useManualTime ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <Clock className="w-3.5 h-3.5" />
              {useManualTime ? 'Manual Start Time Active' : 'Set Manual Start Time?'}
           </button>
           {useManualTime && (
             <div className="grid grid-cols-2 gap-3 mb-4 animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="date" 
                  value={manualDate} 
                  onChange={(e) => setManualDate(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700"
                />
                <input 
                  type="time" 
                  value={manualTime} 
                  onChange={(e) => setManualTime(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700"
                />
             </div>
           )}
        </div>
        <textarea 
          value={remarks} 
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Shift remarks (optional)..."
          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-20 resize-none"
        />
        <button onClick={() => startMutation.mutate()} disabled={!selectedProduct || startMutation.isPending} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
           {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
           Start Production
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <button onClick={() => setStopConfirmOpen(true)} className="flex flex-col items-center gap-3 p-8 bg-slate-900 text-white rounded-[2.5rem] hover:bg-black transition-all group">
         <Square className="w-6 h-6 fill-white group-hover:scale-110 transition-transform" />
         <span className="text-[10px] font-black uppercase tracking-widest">Stop Batch</span>
      </button>
      <button onClick={() => setChangeoverModalOpen(true)} className="flex flex-col items-center gap-3 p-8 bg-amber-500 text-white rounded-[2.5rem] hover:bg-amber-600 transition-all group">
         <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
         <span className="text-[10px] font-black uppercase tracking-widest">Changeover</span>
      </button>
      
      {stopConfirmOpen && (
        <Modal onClose={() => setStopConfirmOpen(false)}>
           <h3 className="text-xl font-black mb-4">Confirm Stop</h3>
           <p className="text-slate-500 mb-6">Are you sure you want to terminate production on {line.name}?</p>
           <textarea 
             value={stopRemarks} 
             onChange={(e) => setStopRemarks(e.target.value)}
             placeholder="End of shift remarks (optional)..."
             className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 h-24 resize-none mb-8"
           />
           <div className="flex gap-4">
              <button onClick={() => setStopConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Cancel</button>
              <button onClick={() => stopMutation.mutate()} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold">Stop</button>
           </div>
        </Modal>
      )}

      {changeoverModalOpen && (
        <Modal onClose={() => setChangeoverModalOpen(false)}>
           <h3 className="text-xl font-black mb-4">Product Changeover</h3>
           <select value={changeoverProduct} onChange={(e) => setChangeoverProduct(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 mb-8">
              <option value="">Select New Product</option>
              {products?.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
           <div className="flex gap-4">
              <button onClick={() => setChangeoverModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Cancel</button>
              <button onClick={() => changeoverMutation.mutate()} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-bold">Update</button>
           </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function LineControlCard({ line, brands, products, shifts, canManage, isFocused, onFocus }: any) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Form state for starting a batch
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [remarks, setRemarks] = useState('');
  const [stopRemarks, setStopRemarks] = useState('');

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [changeoverModalOpen, setChangeoverModalOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [changeoverProduct, setChangeoverProduct] = useState('');
  const [editName, setEditName] = useState(line.name);
  const [editDesc, setEditDesc] = useState(line.description || '');

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch active batch for this line when it's RUNNING or CHANGEOVER
  const { data: activeBatch } = useQuery({
    queryKey: ['active-batch', line.id],
    queryFn: async () => {
      const res = await api.get(`/production/active/${line.id}`);
      return res.data;
    },
    enabled: line.status === 'RUNNING' || line.status === 'CHANGEOVER',
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-lines'] });
    queryClient.invalidateQueries({ queryKey: ['active-batch', line.id] });
    queryClient.invalidateQueries({ queryKey: ['lines'] });
  };

  // ── START BATCH ──
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBrand || !selectedProduct || !selectedShift)
        throw new Error('Please select brand, product, and shift');
      const res = await api.post('/production/start', {
        factoryId: line.factoryId,
        lineId: line.id,
        brandId: selectedBrand,
        productId: selectedProduct,
        shiftId: selectedShift,
        createdBy: user?.id,
        remarks: remarks,
      });
      return res.data;
    },
    onSuccess: (data) => {
      invalidate();
      setSelectedBrand(''); setSelectedProduct(''); setSelectedShift('');
      toast.success(`Batch ${data.batchCode} started on ${line.name}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  // ── STOP / CLOSE BATCH ──
  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!activeBatch?.id) throw new Error('No active batch found');
      await api.put(`/production/${activeBatch.id}/close`, { remarks: stopRemarks });
    },
    onSuccess: () => {
      invalidate();
      setStopConfirmOpen(false);
      setStopRemarks('');
      toast.success(`Batch closed on ${line.name}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  // ── CHANGEOVER ──
  const changeoverMutation = useMutation({
    mutationFn: async () => {
      if (!activeBatch?.id) throw new Error('No active batch found');
      if (!changeoverProduct) throw new Error('Please select the new product');
      await api.post(`/production/line/${line.id}/changeover`, {
        productId: changeoverProduct,
        batchId: activeBatch.id,
      });
    },
    onSuccess: () => {
      invalidate();
      setChangeoverModalOpen(false);
      setChangeoverProduct('');
      toast.success(`Changeover initiated on ${line.name}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  const completeChangeoverMutation = useMutation({
    mutationFn: async () => {
      if (!activeBatch?.id) throw new Error('No active batch found');
      await api.post(`/production/batch/${activeBatch.id}/complete-changeover`);
    },
    onSuccess: () => {
      invalidate();
      toast.success(`Changeover completed. New batch started.`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/production/line/${line.id}/toggle-maintenance`);
    },
    onSuccess: () => {
      invalidate();
      toast.success(`Line status updated`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  // ── EDIT LINE ──
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editName.trim()) throw new Error('Line name cannot be empty');
      return await api.patch(`/master-data/lines/${line.id}`, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditModalOpen(false);
      toast.success('Line updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message),
  });

  // ── DELETE LINE ──
  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/master-data/lines/${line.id}`),
    onSuccess: () => {
      invalidate();
      setDeleteModalOpen(false);
      toast.success(`Line "${line.name}" deleted`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Cannot delete a line with active batches'),
  });

  const filteredProducts = products?.filter((p: any) =>
    !selectedBrand || p.brandId === selectedBrand
  );

  const changeoverProducts = products?.filter((p: any) =>
    activeBatch ? p.id !== activeBatch.product?.id : true
  );

  return (
    <>
      {/* ── CARD ── */}
      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
            <div onClick={!isFocused ? onFocus : undefined} className={`flex items-center gap-5 ${!isFocused ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}>
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.25rem] flex items-center justify-center">
                <Gauge className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{line.name}</h3>
                {line.description && <p className="text-xs text-slate-400 mt-0.5">{line.description}</p>}
                {!isFocused && <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Click for detail view</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    line.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
                    line.status === 'CHANGEOVER' ? 'bg-amber-500 animate-pulse' :
                    line.status === 'MAINTENANCE' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                    'bg-slate-300'
                  }`} />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {line.status === 'MAINTENANCE' ? 'UNDER MAINTENANCE' : line.status}
                  </span>
                </div>
              </div>
            </div>

          {canManage && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-50 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 min-w-[160px]">
                  <button
                    onClick={() => { setMenuOpen(false); setEditName(line.name); setEditDesc(line.description || ''); setEditModalOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="w-4 h-4 text-blue-500" /> Edit Line
                  </button>
                  <div className="h-px bg-slate-100 mx-3 my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); toggleMaintenanceMutation.mutate(); }}
                    disabled={line.status === 'RUNNING' || line.status === 'CHANGEOVER'}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Wrench className="w-4 h-4 text-blue-500" /> {line.status === 'MAINTENANCE' ? 'End Maintenance' : 'Start Maintenance'}
                  </button>
                  <div className="h-px bg-slate-100 mx-3 my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); setDeleteModalOpen(true); }}
                    disabled={line.status !== 'IDLE'}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Line
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="mb-8">
          {line.status === 'IDLE' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select Shift</option>
                  {shifts?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={selectedBrand}
                    onChange={(e) => { setSelectedBrand(e.target.value); setSelectedProduct(''); }}
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Brand</option>
                    {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Product</option>
                    {filteredProducts?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                    ))}
                  </select>
                </div>
                <textarea 
                  value={remarks} 
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Batch remarks (optional)..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-20 resize-none"
                />
              </div>
            </div>
          ) : line.status === 'MAINTENANCE' ? (
            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                 <Construction className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-rose-900 uppercase tracking-widest">Maintenance Mode</p>
                <p className="text-sm font-bold text-rose-700">Line is currently unavailable for production.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className={`${line.status === 'CHANGEOVER' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} rounded-3xl p-5 border transition-colors relative`}>
                <p className={`text-[10px] font-black ${line.status === 'CHANGEOVER' ? 'text-amber-500' : 'text-slate-400'} uppercase tracking-widest mb-1`}>
                  {line.status === 'CHANGEOVER' ? 'In Changeover' : 'Current Batch'}
                </p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {activeBatch?.batchCode || (
                    <span className="flex items-center gap-1 text-rose-500">
                      <AlertTriangle className="w-3 h-3" /> State Error
                    </span>
                  )}
                </p>
              </div>
              <div className={`${line.status === 'CHANGEOVER' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'} rounded-3xl p-5 border transition-colors`}>
                <p className={`text-[10px] font-black ${line.status === 'CHANGEOVER' ? 'text-amber-500' : 'text-slate-400'} uppercase tracking-widest mb-1`}>Brand / Product</p>
                {activeBatch ? (
                  <>
                    <p className="text-sm font-black text-slate-900 truncate">{activeBatch.brand?.name || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{activeBatch.product?.name || ''}</p>
                  </>
                ) : (
                  <p className="text-xs font-bold text-slate-400 italic">No batch data</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Analytics Detail (Visible when focused) */}
        {isFocused && (
          <div className="mb-8 border-t border-slate-50 pt-8 animate-in fade-in slide-in-from-top-4 duration-500">
             <LineAnalytics lineId={line.id} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {line.status === 'IDLE' ? (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || !selectedBrand || !selectedProduct || !selectedShift}
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Start Production
            </button>
          ) : line.status === 'MAINTENANCE' ? (
            <button
              onClick={() => toggleMaintenanceMutation.mutate()}
              className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all"
            >
              <ShieldAlert className="w-4 h-4" /> Restore Line to Idle
            </button>
          ) : line.status === 'CHANGEOVER' ? (
            <button
              onClick={() => completeChangeoverMutation.mutate()}
              disabled={completeChangeoverMutation.isPending}
              className="flex-1 bg-amber-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
            >
              {completeChangeoverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Complete Changeover
            </button>
          ) : activeBatch ? (
            <>
              <button
                onClick={() => setStopConfirmOpen(true)}
                className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all"
              >
                <Square className="w-4 h-4 fill-white" /> Stop Batch
              </button>
              <button
                onClick={() => setChangeoverModalOpen(true)}
                className="flex-1 bg-amber-50 text-amber-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-100 transition-all border border-amber-200"
              >
                <RefreshCcw className="w-4 h-4" /> Changeover
              </button>
            </>
          ) : (
            <button
              onClick={async () => {
                if (!confirm("Are you sure? This will force the line to IDLE and close any hung batches.")) return;
                try {
                  await api.put(`/production/line/${line.id}/reset`);
                  invalidate();
                  toast.success('Line status forced to IDLE');
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Reset failed');
                }
              }}
              className="flex-1 bg-rose-50 text-rose-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-all border border-rose-100"
            >
              <ZapOff className="w-4 h-4" /> Emergency Sync
            </button>
          )}
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editModalOpen && (
        <Modal onClose={() => !editMutation.isPending && setEditModalOpen(false)}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Edit Line</h2>
              <p className="text-sm text-slate-400 mt-0.5">Update production line details</p>
            </div>
            <button onClick={() => setEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="space-y-4">
            <FormField label="Line Name">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="e.g. Line 1" autoFocus />
            </FormField>
            <FormField label="Description (optional)">
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="e.g. Main water bottling line" />
            </FormField>
          </div>
          <div className="flex gap-3 mt-7">
            <button onClick={() => setEditModalOpen(false)} disabled={editMutation.isPending}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName.trim()}
              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteModalOpen && (
        <Modal onClose={() => !deleteMutation.isPending && setDeleteModalOpen(false)}>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Delete Line?</h2>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{line.name}"</span>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDeleteModalOpen(false)} disabled={deleteMutation.isPending}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ── STOP CONFIRM MODAL ── */}
      {stopConfirmOpen && (
        <Modal onClose={() => !stopMutation.isPending && setStopConfirmOpen(false)}>
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Stop Production?</h2>
            <p className="text-sm text-slate-500 mt-2">
              This will close batch <span className="font-bold text-slate-800">{activeBatch?.batchCode}</span> on <span className="font-bold text-slate-800">{line.name}</span>.
            </p>
          </div>
          <textarea 
            value={stopRemarks} 
            onChange={(e) => setStopRemarks(e.target.value)}
            placeholder="Closing remarks (optional)..."
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-24 resize-none mb-6"
          />
          <div className="flex gap-3">
            <button onClick={() => setStopConfirmOpen(false)} disabled={stopMutation.isPending}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}
              className="flex-1 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50">
              {stopMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-white" />}
              Stop Batch
            </button>
          </div>
        </Modal>
      )}

      {/* ── CHANGEOVER MODAL ── */}
      {changeoverModalOpen && (
        <Modal onClose={() => !changeoverMutation.isPending && setChangeoverModalOpen(false)}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Initiate Changeover</h2>
              <p className="text-sm text-slate-400 mt-0.5">Switch to a new product on {line.name}</p>
            </div>
            <button onClick={() => setChangeoverModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Current Product</p>
              <p className="text-sm font-black text-amber-900">{activeBatch?.product?.name || '—'}</p>
            </div>
            <FormField label="Switch to Product">
              <select value={changeoverProduct} onChange={(e) => setChangeoverProduct(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                <option value="">Select new product</option>
                {changeoverProducts?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="flex gap-3 mt-7">
            <button onClick={() => setChangeoverModalOpen(false)} disabled={changeoverMutation.isPending}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={() => changeoverMutation.mutate()} disabled={changeoverMutation.isPending || !changeoverProduct}
              className="flex-1 py-3 rounded-2xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 flex items-center justify-center gap-2 disabled:opacity-50">
              {changeoverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Start Changeover
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI Helpers

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-150">
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function LineAnalytics({ lineId }: { lineId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['line-performance-detail', lineId],
    queryFn: async () => (await api.get('/analytics/line-performance', { params: { lineId } })).data,
    refetchInterval: 10000,
    enabled: !!lineId && lineId !== 'all'
  });

  if (isLoading) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm font-bold">Synchronizing telemetry...</div>;
  if (!stats) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm italic">No live metrics available for this line.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">OEE Rate</span>
          </div>
          <p className="text-2xl font-black text-indigo-900">{stats.oee}%</p>
        </div>
        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Real-time BPM</span>
          </div>
          <p className="text-2xl font-black text-emerald-900">{Math.round(stats.bpm)}</p>
        </div>
        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Team</span>
          </div>
          <p className="text-2xl font-black text-blue-900">{stats.activeOperators}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yesterday</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.yesterday?.oee}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Historical Performance (24h)</h4>
          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Output Target</span>
                <span className="text-xs font-black text-slate-900">45,000 / 50,000</span>
             </div>
             <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '90%' }} />
             </div>
             <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-slate-500">Scheduled Downtime</span>
                <span className="text-xs font-black text-slate-900">12 Mins</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Unscheduled Stop</span>
                <span className="text-xs font-black text-rose-600">8 Mins</span>
             </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-6 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
             <Activity className="w-20 h-20 text-white" />
          </div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">Production Insight</h4>
          <p className="text-sm font-bold leading-relaxed relative z-10">
            {stats.bpm > 110 
              ? "Running at peak efficiency. Ensure raw materials are staged for the next hour."
              : "Throughput is slightly below target. Checking for micro-stoppages at labeling station."}
          </p>
          <div className="mt-4 flex items-center gap-2 relative z-10">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live AI Assistant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
