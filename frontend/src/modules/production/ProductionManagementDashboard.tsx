import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BarChart3,
  Check,
  ChevronRight,
  Database,
  Factory,
  Layers,
  Loader2,
  PackageCheck,
  Search,
  Clock,
  Activity,
  Box,
  ArrowLeft
} from 'lucide-react';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';

type BatchStatus = 'RUNNING' | 'CHANGEOVER' | 'COMPLETED' | 'CLOSED' | string;

interface ProductionLine {
  id: string;
  name: string;
}

interface ProductionBatchRow {
  id: string;
  batchCode: string;
  lineId: string;
  status: BatchStatus;
  startTime?: string;
  endTime?: string | null;
  targetQuantity?: number | null;
  line?: ProductionLine | null;
  product?: { id?: string | null; name?: string | null } | null;
  brand?: { id?: string | null; name?: string | null } | null;
  shift?: { name?: string | null } | null;
}

const statusClass = (status: BatchStatus) => {
  switch (status) {
    case 'RUNNING':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'CHANGEOVER':
      return 'bg-sky-50 text-sky-700 border-sky-100';
    case 'COMPLETED':
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return format(date, 'MMM dd, yyyy HH:mm');
};

const StatCard = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{value}</p>
      </div>
      <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1A9A91]">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default function ProductionManagementDashboard() {
  const [selectedLineId, setSelectedLineId] = useState('ALL');
  const [selectedBatchCode, setSelectedBatchCode] = useState('ALL');
  const [batchScope, setBatchScope] = useState<'ALL' | 'PREVIOUS'>('ALL');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data: batches = [], isLoading: loadingBatches } = useQuery<ProductionBatchRow[]>({
    queryKey: ['production-batches-all'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data,
  });

  const { data: lines = [] } = useQuery<ProductionLine[]>({
    queryKey: ['master-data-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data,
  });

  const filteredBatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const matchesLine = selectedLineId === 'ALL' || batch.lineId === selectedLineId;
      const matchesBatch = selectedBatchCode === 'ALL' || batch.batchCode === selectedBatchCode;
      const matchesScope = batchScope === 'ALL' || !['RUNNING', 'CHANGEOVER'].includes(batch.status);
      const matchesSearch =
        !term ||
        batch.batchCode?.toLowerCase().includes(term) ||
        batch.product?.name?.toLowerCase().includes(term) ||
        batch.brand?.name?.toLowerCase().includes(term) ||
        batch.line?.name?.toLowerCase().includes(term);

      return matchesLine && matchesBatch && matchesScope && matchesSearch;
    });
  }, [batches, batchScope, search, selectedBatchCode, selectedLineId]);

  const overview = useMemo(() => {
    const running = filteredBatches.filter((batch) => ['RUNNING', 'CHANGEOVER'].includes(batch.status)).length;
    const completed = filteredBatches.filter((batch) => ['COMPLETED', 'CLOSED'].includes(batch.status)).length;
    const target = filteredBatches.reduce((sum, batch) => sum + Number(batch.targetQuantity || 0), 0);

    return {
      total: Array.from(new Set(filteredBatches.map(b => b.batchCode))).length,
      running,
      completed,
      target,
    };
  }, [filteredBatches]);

  const groupedBatches = useMemo(() => {
    const groups = new Map<string, any>();
    for (const batch of filteredBatches) {
      if (!groups.has(batch.batchCode)) {
        groups.set(batch.batchCode, {
          ...batch,
          linesCount: 1,
          products: new Set([batch.product?.name].filter(Boolean)),
          totalTarget: Number(batch.targetQuantity || 0)
        });
      } else {
        const group = groups.get(batch.batchCode);
        group.linesCount += 1;
        if (batch.product?.name) group.products.add(batch.product.name);
        group.totalTarget += Number(batch.targetQuantity || 0);
      }
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      productsDisplay: Array.from(g.products).join(', ')
    }));
  }, [filteredBatches]);

  const isSingleBatchView = selectedBatchCode !== 'ALL' && filteredBatches.length > 0;

  const singleBatchSummary = useMemo(() => {
    if (!isSingleBatchView) return null;
    const firstBatch = filteredBatches[0];
    const totalTarget = filteredBatches.reduce((sum, b) => sum + Number(b.targetQuantity || 0), 0);
    const products = Array.from(new Set(filteredBatches.map(b => b.product?.name).filter(Boolean)));
    const linesRunning = filteredBatches.length;

    const startTimes = filteredBatches.map(b => b.startTime ? new Date(b.startTime).getTime() : null).filter(Boolean) as number[];
    const earliestTime = startTimes.length > 0 ? Math.min(...startTimes) : null;

    const runningDurationMinutes = earliestTime
      ? Math.max(0, Math.round((new Date().getTime() - earliestTime) / 60000))
      : 0;

    return {
      batchCode: firstBatch.batchCode,
      status: firstBatch.status,
      shift: firstBatch.shift?.name || 'Unknown',
      startTime: firstBatch.startTime,
      linesRunning,
      products,
      totalTarget,
      runningDurationMinutes,
      lines: filteredBatches
    };
  }, [isSingleBatchView, filteredBatches]);

  if (loadingBatches) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-[#1A9A91]" />
        <p className="text-[10px] font-black uppercase tracking-widest">Loading batches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#1A9A91]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Batch Overview</h2>
              <p className="text-xs font-semibold text-slate-500">Review production batches across all lines or a selected line.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setBatchScope('ALL');
              setSelectedBatchCode('ALL');
            }}
            className={`h-10 px-4 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-colors ${batchScope === 'ALL' && selectedBatchCode === 'ALL'
              ? 'bg-[#1A9A91] text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {batchScope === 'ALL' && selectedBatchCode === 'ALL' ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            All
          </button>

          <button
            type="button"
            onClick={() => {
              setBatchScope('PREVIOUS');
              setSelectedBatchCode('ALL');
            }}
            className={`h-10 px-4 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-colors ${batchScope === 'PREVIOUS'
              ? 'bg-[#1A9A91] text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Database className="h-4 w-4" />
            Previous Batches
          </button>

          <select
            value={selectedBatchCode}
            onChange={(event) => {
              setSelectedBatchCode(event.target.value);
              if (event.target.value !== 'ALL') setBatchScope('ALL');
            }}
            className="h-10 min-w-[210px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] focus:ring-2 focus:ring-[#1A9A91]/15"
          >
            <option value="ALL">All Batches</option>
            {Array.from(new Set(batches.map(b => b.batchCode))).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <select
            value={selectedLineId}
            onChange={(event) => setSelectedLineId(event.target.value)}
            className="h-10 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] focus:ring-2 focus:ring-[#1A9A91]/15"
          >
            <option value="ALL">All Lines</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStation}
            onChange={(event) => setSelectedStation(event.target.value)}
            className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] focus:ring-2 focus:ring-[#1A9A91]/15"
          >
            <option value="ALL">All Stations</option>
            <option value="BLOWING">Blowing</option>
            <option value="FILLING">Filling</option>
            <option value="LABELING">Labeling</option>
            <option value="PACKING">Packing</option>
            <option value="DISPATCH">Dispatch</option>
            <option value="QUALITY">Quality</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Batches" value={overview.total} icon={Database} />
        <StatCard label="Running" value={overview.running} icon={Factory} />
        <StatCard label="Completed" value={overview.completed} icon={PackageCheck} />
        <StatCard label="Target Qty" value={overview.target.toLocaleString()} icon={BarChart3} />
      </div>

      {isSingleBatchView && singleBatchSummary ? (
        <SingleBatchView summary={singleBatchSummary} selectedLineId={selectedLineId} selectedStation={selectedStation} onBack={() => setSelectedBatchCode('ALL')} />
      ) : (
        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Batches</h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedLineId === 'ALL'
                  ? 'Showing all line data'
                  : `Showing data for ${lines.find((line) => line.id === selectedLineId)?.name || 'selected line'}`}
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search batch, product, brand..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#1A9A91] focus:bg-white focus:ring-2 focus:ring-[#1A9A91]/15"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Batch</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Line</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Shift</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Product</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Brand</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Target</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Start Time</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedBatches.map((batch) => (
                  <tr
                    key={batch.batchCode}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedBatchCode(batch.batchCode)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{batch.batchCode}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{batch.linesCount} Lines</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-700">{batch.linesCount > 1 ? 'Multiple' : (batch.line?.name || 'Unassigned')}</td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-500">{batch.shift?.name || 'Unknown Shift'}</td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-700 truncate max-w-[150px]">{batch.productsDisplay || 'Unknown Product'}</td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-500">{batch.brand?.name || 'Unknown Brand'}</td>
                    <td className="px-5 py-4 text-xs font-black tabular-nums text-slate-900">
                      {Number(batch.totalTarget || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(batch.startTime)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(batch.status)}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </td>
                  </tr>
                ))}

                {groupedBatches.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center">
                      <div className="mx-auto h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                        <Database className="h-6 w-6" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-500">No batches found</p>
                      <p className="mt-1 text-xs text-slate-400">Try another line or clear the search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const SingleBatchView = ({ summary, selectedLineId, selectedStation, onBack }: any) => {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['batch-dossiers', summary.batchCode],
    queryFn: async () => {
      const promises = summary.lines.map((line: any) =>
        api.get(ENDPOINTS.REPORTS.BATCH_DOSSIER(line.id)).then(res => ({
          lineId: line.id,
          batchRow: line,
          dossier: res.data
        }))
      );
      return Promise.all(promises);
    },
    enabled: !!summary.lines.length
  });

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-[#1A9A91]" />
        <p className="text-[10px] font-black uppercase tracking-widest">Loading detailed analytics...</p>
      </div>
    );
  }

  const filteredDossiers = dossiers.filter(d => selectedLineId === 'ALL' || d.lineId === selectedLineId);

  const globalProduced = dossiers.reduce((acc, d) => acc + Number(d.dossier?.totals?.casesTotal || 0), 0);
  const globalRejected = dossiers.reduce((acc, d) => acc + Number(d.dossier?.totals?.scrapTotal || 0), 0);
  const globalDispatch = dossiers.reduce((acc, d) => acc + Number(d.dossier?.dispatch?.total || 0), 0);
  const globalDamage = dossiers.reduce((acc, d) => acc + Number(d.dossier?.quality?.damages || 0), 0);
  const globalReturns = dossiers.reduce((acc, d) => acc + Number(d.dossier?.quality?.returns || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* AGGREGATED BATCH SUMMARY */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button 
                onClick={onBack}
                className="p-1.5 -ml-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Back to All Batches"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Batch Information</h3>
            </div>
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black text-slate-900">{summary.batchCode}</h2>
              <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${statusClass(summary.status)}`}>
                {summary.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shift</p>
              <p className="text-sm font-bold text-slate-900">{summary.shift}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Started</p>
              <p className="text-sm font-bold text-slate-900">{formatDate(summary.startTime)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</p>
              <p className="text-sm font-bold text-slate-900">{summary.runningDurationMinutes} Mins</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Lines</p>
            <p className="text-xl font-black text-slate-900">{summary.linesRunning}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Products</p>
            <p className="text-xs font-bold text-slate-700 leading-tight">
              {summary.products.join(', ') || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Produced Cases</p>
            <p className="text-xl font-black text-[#1A9A91]">{globalProduced.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rejections</p>
            <p className="text-xl font-black text-rose-500">{globalRejected.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dispatch</p>
            <p className="text-xl font-black text-slate-900">{globalDispatch.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Damage</p>
            <p className="text-xl font-black text-orange-500">{globalDamage.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Returns</p>
            <p className="text-xl font-black text-slate-500">{globalReturns.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* LINE BY LINE ANALYSIS */}
      <div className="space-y-8">
        {filteredDossiers.map(({ lineId, batchRow, dossier }) => {
          const target = Number(batchRow.targetQuantity || 1);
          const produced = Number(dossier?.totals?.packingTotal || 0);
          const efficiency = target > 0 ? ((produced / target) * 100).toFixed(1) : '0.0';

          const timeline = dossier?.timeline || [];
          const stationLogs = dossier?.stationLogs || [];
          const filteredStations = stationLogs.filter((s: any) => selectedStation === 'ALL' || s.station === selectedStation);

          return (
            <div key={lineId} className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-900 shadow-sm">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest">{batchRow.line?.name || 'Unknown Line'}</h3>
                  <p className="text-xs font-bold text-slate-500">ID: {batchRow.id.slice(0, 8)}</p>
                </div>
              </div>

              {/* Line Summary Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Line Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Product</p>
                    <p className="text-sm font-bold text-slate-900">{batchRow.product?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest mt-1 ${statusClass(batchRow.status)}`}>
                      {batchRow.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Operator</p>
                    <p className="text-sm font-bold text-slate-900">{dossier?.metadata?.creator || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Efficiency</p>
                    <p className="text-xl font-black text-[#1A9A91] tabular-nums">{efficiency}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Produced</p>
                    <p className="text-xl font-black text-slate-900 tabular-nums">
                      {produced.toLocaleString()} <span className="text-xs text-slate-400">/ {target.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Station Breakdown */}
              {(selectedStation === 'ALL' || selectedStation !== 'QUALITY') && (
                <div className="mb-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-2">Station Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredStations.map((station: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#1A9A91]" />
                            {station.station}
                          </h5>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {station.station === 'PACKING' ? 'Produced Cases' : 'Production Unit Count'}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {station.station === 'PACKING' && station.cases !== undefined
                                ? station.cases.toLocaleString()
                                : station.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waste</span>
                            <span className="text-sm font-black text-rose-500">{station.waste.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator</span>
                            <span className="text-xs font-bold text-slate-700">{station.operator || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredStations.length === 0 && (
                      <div className="col-span-3 text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-400">
                        <p className="text-xs font-bold">No logs found for selected station.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Material Consumption & Timeline Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Material Consumption */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                    <Box className="w-4 h-4" /> Material Consumption
                  </h4>
                  <div className="space-y-4">
                    {dossier?.materials && dossier.materials.length > 0 ? (
                      dossier.materials.map((mat: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                          <span className="text-xs font-bold text-slate-600">{mat.name}</span>
                          <span className="text-sm font-black text-slate-900">
                            {mat.quantity.toLocaleString()} <span className="text-[10px] text-slate-400">{mat.unit}</span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <span className="text-xs font-bold text-slate-400">No material consumption recorded for this batch yet.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-80 flex flex-col">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Production Timeline
                  </h4>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    {timeline.map((event: any, idx: number) => (
                      <div key={idx} className="flex gap-4 relative">
                        {idx !== timeline.length - 1 && <div className="absolute left-2.5 top-6 bottom-[-24px] w-0.5 bg-slate-100"></div>}
                        <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex-shrink-0 z-10 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-[#1A9A91]"></div>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">{event.type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                            {formatDate(event.time)} • {event.station}
                          </p>
                          {event.remarks && <p className="text-xs text-slate-600 mt-1 italic">"{event.remarks}"</p>}
                        </div>
                      </div>
                    ))}
                    {timeline.length === 0 && (
                      <div className="text-center text-slate-400 text-xs font-bold pt-10">No timeline events recorded.</div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  );
};
