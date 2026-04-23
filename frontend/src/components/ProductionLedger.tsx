import { useState } from 'react';
import { 
  ClipboardPaste, Save, Trash2, 
  Calendar, Hash, Package, 
  AlertTriangle, CheckCircle2,
  Wind, PackageOpen, Zap, Box, Loader2
} from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

type Station = 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';

interface LedgerEntry {
  date: string;
  batchCode: string;
  station: Station;
  primaryCount: number;
  wastageCount: number;
  meta: Record<string, any>;
  remarks: string;
}

export default function ProductionLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);

  const parseBulkText = () => {
    try {
      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const newEntries: LedgerEntry[] = [];
      let currentDate = '';
      let currentStation: Station | null = null;

      // Simple heuristic parser for the user's specific format
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect Date
        const dateMatch = line.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (dateMatch && !line.includes('Expiry') && !line.includes('Production Date')) {
          currentDate = dateMatch[1];
        }

        // Detect Station Type by content keywords
        if (line.includes('blowing machine')) currentStation = 'BLOWING';
        if (line.includes('filling machine')) currentStation = 'FILLING';
        if (line.includes('Labelling')) currentStation = 'LABELING';
        if (line.includes('packing')) currentStation = 'PACKING';

        // Detect Data Fields (Blowing)
        if (currentStation === 'BLOWING' && line.includes('Total production')) {
          const count = parseInt(line.split(':')[1]);
          const rejectionLine = lines[i+1]?.includes('rejection') ? lines[i+1] : '';
          const rejection = parseInt(rejectionLine.split(':')[1]) || 0;
          const bagsLine = lines[i+2]?.includes('bags') ? lines[i+2] : '';
          const bags = parseInt(bagsLine.split(':')[1]) || 0;
          
          newEntries.push({
            date: currentDate,
            batchCode: `BW-${currentDate.replace(/\//g, '')}`,
            station: 'BLOWING',
            primaryCount: count,
            wastageCount: rejection,
            meta: { bagsUsed: bags },
            remarks: 'Imported from book'
          });
        }

        // Detect Data Fields (Filling/Labeling/Packing)
        if (line.includes('Batch No') || line.includes('Batch no')) {
          const batchCode = line.split(':')[1].trim();
          const prodDateLine = lines.find((l, idx) => Math.abs(idx - i) < 5 && (l.includes('Production date') || l.includes('Production Date')));
          const entryDate = prodDateLine ? prodDateLine.split(':')[1].trim() : currentDate;
          
          const prodLine = lines.find((l, idx) => Math.abs(idx - i) < 5 && l.includes('Total Production'));
          const countStr = prodLine ? prodLine.split(':')[1].trim() : '0';
          // Handle "35785 + 30"
          const primaryCount = countStr.split('+').reduce((acc, v) => acc + (parseInt(v.trim()) || 0), 0);

          const rejLine = lines.find((l, idx) => Math.abs(idx - i) < 5 && (l.includes('rejection') || l.includes('Rejection')));
          const rejStr = rejLine ? rejLine.split(':')[1].trim() : '0';
          const wastageCount = rejStr.includes('=') ? parseInt(rejStr.split('=')[1]) : rejStr.split('+').reduce((acc, v) => acc + (parseInt(v.trim()) || 0), 0);

          const brandLine = lines.find((l, idx) => Math.abs(idx - i) < 5 && (l.includes('Brand') || l.includes('Brand name')));
          const brand = brandLine ? brandLine.split(':')[1].trim() : '';

          if (currentStation) {
            newEntries.push({
              date: entryDate,
              batchCode,
              station: currentStation,
              primaryCount,
              wastageCount: isNaN(wastageCount) ? 0 : wastageCount,
              meta: { brand },
              remarks: 'Imported from book'
            });
          }
        }
      }

      if (newEntries.length === 0) {
        toast.error('No valid production data found in the text.');
      } else {
        setEntries([...entries, ...newEntries]);
        setBulkText('');
        toast.success(`Parsed ${newEntries.length} entries from text.`);
      }
    } catch (err) {
      toast.error('Parsing failed. Please check the format.');
      console.error(err);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      // 1. Get required IDs (assuming defaults for now or fetching them)
      const linesRes = await api.get('/master-data/lines');
      const lineId = linesRes.data[0]?.id;
      const brandsRes = await api.get('/master-data/brands');
      const productsRes = await api.get('/master-data/products');
      const shiftsRes = await api.get('/master-data/shifts');
      
      const defaultBrandId = brandsRes.data[0]?.id;
      const defaultProductId = productsRes.data[0]?.id;
      const defaultShiftId = shiftsRes.data[0]?.id;

      for (const entry of entries) {
        // 2. Create Historical Batch
        const batchRes = await api.post('/production-batch/historical', {
          batchCode: entry.batchCode,
          productionDate: entry.date,
          lineId,
          brandId: defaultBrandId,
          productId: defaultProductId,
          shiftId: defaultShiftId
        });

        // 3. Create Log
        await api.post('/production-batch/log-historical', {
          station: entry.station,
          payload: {
            batchId: batchRes.data.id,
            userId: (await api.get('/auth/me')).data.id,
            primaryCount: entry.primaryCount,
            wastageCount: entry.wastageCount,
            remarks: entry.remarks,
            loggedAt: entry.date,
            ...entry.meta
          }
        });
      }

      toast.success('All records successfully synchronized with the Digital Book.');
      setEntries([]);
    } catch (err) {
      toast.error('Sync failed. Some records might not have been saved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Parser Tool */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-900/40 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:rotate-12 transition-transform duration-1000">
           <ClipboardPaste className="w-64 h-64 text-blue-400" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-600 rounded-2xl">
              <ClipboardPaste className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight italic">AI Production Parser</h3>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Paste book notes to digitize</p>
            </div>
          </div>

          <textarea 
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Paste your production notes here... (e.g. 10/03/26 Total production: 35785...)"
            className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-white/20 custom-scrollbar mb-6"
          />

          <button 
            onClick={parseBulkText}
            disabled={!bulkText.trim()}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
          >
            <Zap className="w-4 h-4" /> Start Intelligent Analysis
          </button>
        </div>
      </div>

      {/* Entry List */}
      {entries.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-8">
             <div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ledger Preview</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Verify parsed data before sync</p>
             </div>
             <button 
              onClick={() => setEntries([])}
              className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
             >
               <Trash2 className="w-5 h-5" />
             </button>
          </div>

          <div className="space-y-3 mb-10">
            {entries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-6 p-5 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  entry.station === 'BLOWING' ? 'bg-blue-600 text-white' :
                  entry.station === 'FILLING' ? 'bg-emerald-500 text-white' :
                  entry.station === 'LABELING' ? 'bg-indigo-600 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                  {entry.station === 'BLOWING' && <Wind className="w-6 h-6" />}
                  {entry.station === 'FILLING' && <PackageOpen className="w-6 h-6" />}
                  {entry.station === 'LABELING' && <Zap className="w-6 h-6" />}
                  {entry.station === 'PACKING' && <Box className="w-6 h-6" />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900">{entry.batchCode}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">{entry.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-bold">
                    Primary: <span className="text-slate-900">{entry.primaryCount}</span> | 
                    Wastage: <span className="text-rose-500">{entry.wastageCount}</span>
                    {entry.meta.brand && <> | Brand: <span className="text-blue-600">{entry.meta.brand}</span></>}
                  </p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={() => setEntries(entries.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSaveAll}
            disabled={loading}
            className="w-full py-6 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl shadow-slate-900/40 hover:bg-blue-600 transition-all flex items-center justify-center gap-4 text-sm uppercase tracking-[0.2em]"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 text-emerald-400" /> Commit to Digital Ledger</>}
          </button>
        </div>
      )}

      {/* Manual Entry Form (Simple version) */}
      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
         <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-500 rounded-2xl">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight italic">Manual Entry Mode</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Enter records one by one</p>
            </div>
         </div>
         
         <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Production Date</label>
              <input type="text" placeholder="DD/MM/YY" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Batch Number</label>
              <input type="text" placeholder="e.g. EB26020" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
         </div>
         
         <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mt-10">Use the AI Parser above for faster entry</p>
      </div>
    </div>
  );
}
