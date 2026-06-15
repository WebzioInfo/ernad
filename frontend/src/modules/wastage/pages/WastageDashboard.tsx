import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import { 
  Calendar, ArrowUpRight, ArrowDownRight, TrendingDown, Tag, 
  Activity, Search, Award, ShieldAlert, AlertCircle, RefreshCw, 
  BarChart2, ShieldCheck, MapPin, Loader2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import WastageBatchDrawer from '../components/WastageBatchDrawer';

export default function WastageDashboard() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [selectedFilters, setSelectedFilters] = useState({
    lineId: 'all',
    productId: 'all',
    batchId: 'all'
  });

  const [searchText, setSearchText] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<any>(null);

  // 1. Fetch Lines and Products for filter options
  const { data: lines } = useQuery({
    queryKey: ['master-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  const { data: productsList } = useQuery({
    queryKey: ['master-products'],
    queryFn: async () => (await api.get('/master-data/products')).data
  });

  // 2. Fetch Batches matching current range for filter selection
  const { data: filterBatches } = useQuery({
    queryKey: ['reports-batches-options', dateRange],
    queryFn: async () => {
      const res = await api.get('/reports/batches', {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      return res.data;
    }
  });

  // 3. Main Dashboard Data Query
  const { data: wastageData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['wastage-dashboard', dateRange, selectedFilters],
    queryFn: async () => {
      const res = await api.get('/wastage-intelligence', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
          lineId: selectedFilters.lineId,
          productId: selectedFilters.productId,
          batchId: selectedFilters.batchId
        }
      });
      return res.data;
    }
  });

  // Client-side search and pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredBatchesTable = useMemo(() => {
    if (!wastageData?.batchWastages) return [];
    let items = wastageData.batchWastages;

    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      items = items.filter((b: any) => 
        b.batchCode.toLowerCase().includes(query) ||
        b.lineName.toLowerCase().includes(query) ||
        b.skuName.toLowerCase().includes(query)
      );
    }
    return items;
  }, [wastageData, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredBatchesTable.length / itemsPerPage));
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBatchesTable.slice(start, start + itemsPerPage);
  }, [filteredBatchesTable, currentPage]);

  const handleTrendPointClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const point = data.activePayload[0].payload;
      setSelectedTrendPoint(point);
    }
  };

  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-rose-600/20 text-rose-500 rounded-[1.75rem] border border-rose-500/20 flex items-center justify-center shadow-xl">
              <TrendingDown className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">Wastage Intelligence</h1>
              <p className="text-slate-400 font-bold mt-1 text-sm">Enterprise loss diagnostics, yields ranking, and material leak analytics.</p>
            </div>
          </div>
          <button 
            onClick={() => refetch()}
            className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 flex items-center gap-2 transition-all font-semibold text-xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Control
          </button>
        </div>
      </div>

      {/* Alert / Validation Warnings Banner */}
      {wastageData?.validationWarnings?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl flex items-start gap-4"
        >
          <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-black text-amber-600 uppercase tracking-wider">Validation Warnings Detected</h4>
            <ul className="text-xs text-amber-500/95 font-medium list-disc list-inside space-y-1 leading-relaxed">
              {wastageData.validationWarnings.map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Filters Board */}
      <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-wrap items-center gap-4">
        {/* Dates */}
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-1 min-w-[180px]">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
            <input
              type="date"
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-xs mt-0.5"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-1 min-w-[180px]">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
            <input
              type="date"
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-xs mt-0.5"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>

        {/* Line */}
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-1 min-w-[180px]">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <div className="flex flex-col w-full">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manufacturing Line</span>
            <select
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-xs mt-0.5 w-full"
              value={selectedFilters.lineId}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, lineId: e.target.value }))}
            >
              <option value="all">All Lines</option>
              {lines?.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* SKU / Product */}
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-1 min-w-[180px]">
          <Tag className="w-4 h-4 text-indigo-500" />
          <div className="flex flex-col w-full">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product SKU</span>
            <select
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-xs mt-0.5 w-full"
              value={selectedFilters.productId}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, productId: e.target.value }))}
            >
              <option value="all">All SKUs</option>
              {productsList?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch Code */}
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 flex-1 min-w-[180px]">
          <Activity className="w-4 h-4 text-indigo-500" />
          <div className="flex flex-col w-full">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batch Number</span>
            <select
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-xs mt-0.5 w-full"
              value={selectedFilters.batchId}
              onChange={(e) => setSelectedFilters(prev => ({ ...prev, batchId: e.target.value }))}
            >
              <option value="all">All Batches</option>
              {filterBatches?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.batchCode}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-rose-600" />
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Compiling loss aggregates & telemetry feeds...</p>
        </div>
      ) : (
        <>
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Range Waste (Units)</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tabular-nums">
                {Number(wastageData?.kpis?.selectedRangeWaste || 0).toLocaleString()}
              </h3>
              <div className="flex items-center gap-1.5 mt-3">
                {wastageData?.kpis?.trends?.wasteTrendPct > 0 ? (
                  <span className="flex items-center text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    {wastageData.kpis.trends.wasteTrendPct}%
                  </span>
                ) : (
                  <span className="flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                    <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                    {Math.abs(wastageData?.kpis?.trends?.wasteTrendPct || 0)}%
                  </span>
                )}
                <span className="text-[9px] font-bold text-slate-400 uppercase">vs prev period</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quality Yield</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tabular-nums">
                {wastageData?.kpis?.yieldPct}%
              </h3>
              <div className="flex items-center gap-1.5 mt-3">
                <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border ${wastageData?.kpis?.yieldPct >= 99 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                  {wastageData?.kpis?.yieldPct >= 99 ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {wastageData?.kpis?.yieldPct >= 99 ? 'Optimized' : 'Loss Alert'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Loss</p>
              <h3 className="text-3xl font-black text-rose-600 mt-2 tabular-nums">
                ₹{Number(wastageData?.kpis?.estimatedFinancialLoss || 0).toLocaleString()}
              </h3>
              <p className="text-[9px] font-bold text-slate-400 mt-3.5 uppercase tracking-wider">Estimated Materials Cost</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Worst Line / SKU</p>
                <h4 className="text-base font-black text-slate-900 mt-2 truncate">{wastageData?.kpis?.worstLine?.name || 'N/A'}</h4>
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-2 truncate">SKU: {wastageData?.kpis?.worstSku?.name || 'N/A'}</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Worst Batch</p>
                <h4 className="text-xl font-black text-slate-900 mt-2 truncate">{wastageData?.kpis?.worstBatch?.batchCode || 'N/A'}</h4>
              </div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-2 truncate">Waste: {Number(wastageData?.kpis?.worstBatch?.waste || 0).toLocaleString()} units</p>
            </div>
          </div>

          {/* Timeframe cards row */}
          <div className="grid grid-cols-3 gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Today Waste</p>
              <h4 className="text-2xl font-black mt-1 text-rose-400 tabular-nums">{Number(wastageData?.kpis?.todayWaste || 0).toLocaleString()}</h4>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">This Week Waste</p>
              <h4 className="text-2xl font-black mt-1 text-rose-400 tabular-nums">{Number(wastageData?.kpis?.weekWaste || 0).toLocaleString()}</h4>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">This Month Waste</p>
              <h4 className="text-2xl font-black mt-1 text-indigo-400 tabular-nums">{Number(wastageData?.kpis?.monthWaste || 0).toLocaleString()}</h4>
            </div>
          </div>

          {/* Trend & Line ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-rose-500" />
                    Daily Waste Trend Analytics
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Click any point on the chart to view contributing batches.</p>
                </div>
              </div>

              {/* Trend Chart */}
              <div className="h-72 w-full flex-1">
                {wastageData?.trendData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wastageData.trendData} onClick={handleTrendPointClick}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                        dx={-10}
                      />
                      <ChartTooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} Units`, 'Wastage']}
                        labelFormatter={(val) => `Date: ${val}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="waste" 
                        stroke="#f43f5e" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 7, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-slate-50 rounded-2xl border border-slate-100 border-dashed flex items-center justify-center">
                    <p className="text-sm font-bold text-slate-400">No trend details matches constraints.</p>
                  </div>
                )}
              </div>

              {/* Contributing Batches Box */}
              {selectedTrendPoint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <h5 className="font-black text-slate-700 uppercase tracking-wider">Contributing Batches ({selectedTrendPoint.date})</h5>
                    <button onClick={() => setSelectedTrendPoint(null)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-36 overflow-y-auto custom-scrollbar pr-2">
                    {selectedTrendPoint.batches.map((b: any, i: number) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-slate-200/60 flex justify-between items-center">
                        <span className="font-bold text-slate-800">{b.batchCode}</span>
                        <span className="font-black text-rose-500">{b.waste.toLocaleString()} Units</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </section>

            {/* Line performance rankings */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500" />
                Line Performance rankings
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4">
                {wastageData?.linePerformance?.map((line: any) => (
                  <div 
                    key={line.lineName}
                    className={`p-5 rounded-3xl border flex items-center justify-between ${line.rank === 1 ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/40 border-slate-100'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${line.rank === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-200 text-slate-600'}`}>
                        {line.rank}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-950">{line.lineName}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Yield: {line.yield}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">{line.producedCases.toLocaleString()} Cases</p>
                      <p className="text-[9px] font-bold text-rose-500 uppercase mt-0.5">Waste: {line.waste.toLocaleString()} units</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Material Wastage list & chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Wasted Materials (Bar Chart) */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6">Top Wasted Materials</h3>
              <div className="h-72 w-full flex-1">
                {wastageData?.materialWastage?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wastageData.materialWastage.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="materialName" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                        dx={-10}
                      />
                      <ChartTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} Units`, 'Wastage']}
                      />
                      <Bar dataKey="wasted" radius={[6, 6, 0, 0]}>
                        {wastageData.materialWastage.slice(0, 10).map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 border-dashed">
                    <p className="text-sm font-bold text-slate-400">No material data matches.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Material Loss & Cost Impact Table */}
            <section className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6">Material Wastage Analysis</h3>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Material Name</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4 text-right">Consumed</th>
                      <th className="px-6 py-4 text-right">Wasted</th>
                      <th className="px-6 py-4 text-center">Waste %</th>
                      <th className="px-6 py-4 text-right">Cost Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                    {wastageData?.materialWastage?.map((mat: any) => (
                      <tr key={mat.materialName} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-900">{mat.materialName}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{mat.materialCode}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{mat.consumed.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">{mat.unit}</span></td>
                        <td className="px-6 py-4 text-right tabular-nums text-rose-500">{mat.wasted.toLocaleString()} <span className="text-[9px] text-rose-400/60 font-bold uppercase">{mat.unit}</span></td>
                        <td className="px-6 py-4 text-center tabular-nums">{mat.wastePct}%</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">₹{mat.costImpact.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Station breakdown, SKU yield comparison, and Root Cause Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Station Analysis */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6">Station Wastage Analysis</h3>
              <div className="flex-1 space-y-4">
                {wastageData?.stationWastage?.map((st: any) => (
                  <div key={st.station} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-950 text-sm tracking-tight">{st.station}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                        Output: {st.output.toLocaleString()} | Waste: {st.waste.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black tracking-widest ${st.yield >= 99 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {st.yield}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SKU wastage */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6">SKU Wastage Analysis</h3>
              <div className="flex-1 space-y-4">
                {wastageData?.skuWastage?.map((s: any) => (
                  <div key={s.sku} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-950 text-sm tracking-tight">{s.sku}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                        Produced: {s.produced.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-rose-500">Waste: {s.waste.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Yield: {s.yield}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Root Causes */}
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-black text-slate-900 mb-6">Root Cause Frequency</h3>
              <div className="flex-1 space-y-4">
                {wastageData?.rootCause?.map((cause: any) => (
                  <div key={cause.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{cause.category}</span>
                      <span className="font-black text-slate-950">{cause.count} instances</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${Math.min(100, (cause.count / (wastageData.trendData.length || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Main Batch Wastage Table (Searchable, Sortable, Filtered) */}
          <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">Batch Wastage Analysis</h3>
                <p className="text-xs text-slate-400 mt-0.5">Full batch record logs sorted by highest waste first.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code, line, SKU..."
                  className="bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-2.5 text-xs w-64 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-100 transition-all font-semibold text-slate-700"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="overflow-x-auto min-h-[350px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Batch ID</th>
                    <th className="px-6 py-4">Line</th>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4 text-right">Produced Cases</th>
                    <th className="px-6 py-4 text-right">Waste (Units)</th>
                    <th className="px-6 py-4 text-center">Yield</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                  {paginatedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-20 text-center text-slate-400 font-bold">No batches matching search constraints found.</td>
                    </tr>
                  ) : (
                    paginatedBatches.map((b: any) => (
                      <tr 
                        key={b.id} 
                        onClick={() => setSelectedBatchId(b.id)}
                        className="hover:bg-slate-50/40 transition-all cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-indigo-600">{b.batchCode}</td>
                        <td className="px-6 py-4 text-slate-500">{b.lineName}</td>
                        <td className="px-6 py-4 font-bold text-slate-600">{b.skuName}</td>
                        <td className="px-6 py-4 text-right tabular-nums">{b.producedCases.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-rose-500">{b.waste.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest ${b.yield >= 99 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            {b.yield}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${b.status === 'CLOSED' ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-[10px] font-black uppercase tracking-widest rounded-xl text-slate-600 hover:text-indigo-600 transition-all">
                            Drilldown
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Page {currentPage} of {totalPages} ({filteredBatchesTable.length} Batches)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Batch Details Sliding Drawer */}
      <AnimatePresence>
        {selectedBatchId && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBatchId(null)}
              className="fixed inset-0 bg-black z-40 backdrop-blur-sm"
            />
            <WastageBatchDrawer 
              batchId={selectedBatchId} 
              onClose={() => setSelectedBatchId(null)} 
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
