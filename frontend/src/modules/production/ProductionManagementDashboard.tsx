import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';
import useAuthStore from '../auth/auth.store';

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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const basePath = user?.role === 'MANAGER' ? '/manager' : '/admin';

  const [selectedLineId, setSelectedLineId] = useState('ALL');
  const [selectedBatchCode, setSelectedBatchCode] = useState('ALL');
  const [batchScope, setBatchScope] = useState<'ALL' | 'PREVIOUS'>('ALL');
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
      total: filteredBatches.length,
      running,
      completed,
      target,
    };
  }, [filteredBatches]);

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
            className={`h-10 px-4 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-colors ${
              batchScope === 'ALL' && selectedBatchCode === 'ALL'
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
            className={`h-10 px-4 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-colors ${
              batchScope === 'PREVIOUS'
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Batches" value={overview.total} icon={Database} />
        <StatCard label="Running" value={overview.running} icon={Factory} />
        <StatCard label="Completed" value={overview.completed} icon={PackageCheck} />
        <StatCard label="Target Qty" value={overview.target.toLocaleString()} icon={BarChart3} />
      </div>

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
              {filteredBatches.map((batch) => (
                <tr
                  key={batch.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => navigate(`${basePath}/batch-logs/${batch.id}`)}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-slate-900">{batch.batchCode}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">ID: {batch.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-700">{batch.line?.name || 'Unassigned'}</td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-500">{batch.shift?.name || 'Unknown Shift'}</td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-700">{batch.product?.name || 'Unknown Product'}</td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-500">{batch.brand?.name || 'Unknown Brand'}</td>
                  <td className="px-5 py-4 text-xs font-black tabular-nums text-slate-900">
                    {Number(batch.targetQuantity || 0).toLocaleString()}
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

              {filteredBatches.length === 0 && (
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
    </div>
  );
}
