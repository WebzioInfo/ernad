import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Database,
  Loader2,
  User,
} from 'lucide-react';
import { api } from '../../services/api-client';
import { ENDPOINTS } from '../../constants/endpoints';

type StationId = 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING' | 'QC';

interface ProductionBatchRow {
  id: string;
  batchCode: string;
  lineId: string;
  status: string;
  startTime?: string;
  targetQuantity?: number | null;
  line?: { id: string; name: string } | null;
  product?: { name?: string | null } | null;
  brand?: { name?: string | null } | null;
}

interface BatchHistoryEvent {
  id: string;
  primaryCount?: number;
  wastageCount?: number | string;
  eventType?: string;
  remarks?: string;
  loggedAt?: string;
  userName?: string;
  source?: 'OPERATOR' | 'MACHINE' | 'SYSTEM' | string;
  station?: string;
  rawMaterialName?: string | null;
  bagsUsed?: number | null;
  preformUsage?: number | null;
  capUsage?: number | null;
  capBoxUsage?: number | null;
  secondaryPackagingCount?: number | null;
}

const stations: { id: StationId; label: string }[] = [
  { id: 'BLOWING', label: 'Blowing' },
  { id: 'FILLING', label: 'Filling' },
  { id: 'LABELING', label: 'Labeling' },
  { id: 'PACKING', label: 'Packing' }
];

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return format(date, 'MMM dd, yyyy HH:mm:ss');
};

const formatNumber = (value?: string | number | null) => {
  const numberValue = Number(value || 0);
  return Number.isNaN(numberValue) ? '0' : numberValue.toLocaleString();
};

const eventClass = (source?: string) => {
  switch (source) {
    case 'MACHINE':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case 'SYSTEM':
      return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
};

export default function BatchLogsPage() {
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  const [station, setStation] = useState<StationId>('BLOWING');

  const { data: batches = [], isLoading: loadingBatches } = useQuery<ProductionBatchRow[]>({
    queryKey: ['production-batches-all'],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.BATCHES)).data,
  });

  const batch = batches.find((item) => item.id === batchId);

  const { data: events = [], isLoading: loadingEvents } = useQuery<BatchHistoryEvent[]>({
    queryKey: ['batch-station-history', batchId, station],
    queryFn: async () => (await api.get(ENDPOINTS.TELEMETRY.HISTORY(batchId!, station))).data,
    enabled: !!batchId,
  });

  const summary = useMemo(() => {
    return events.reduce(
      (acc, event) => ({
        output: acc.output + Number(event.primaryCount || 0),
        wastage: acc.wastage + Number(event.wastageCount || 0),
        events: acc.events + 1,
      }),
      { output: 0, wastage: 0, events: 0 }
    );
  }, [events]);

  if (loadingBatches) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-[#1A9A91]" />
        <p className="text-[10px] font-black uppercase tracking-widest">Loading batch logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#1A9A91]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {batch?.batchCode || 'Batch Logs'}
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {batch
                ? `${batch.line?.name || 'Unassigned line'} • ${batch.product?.name || 'Unknown Product'} • ${batch.status}`
                : 'Batch details unavailable, showing logs by ID.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 min-w-full sm:min-w-[420px] lg:min-w-[480px]">
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Events</p>
            <p className="text-lg font-black text-slate-900">{summary.events}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Output</p>
            <p className="text-lg font-black text-slate-900">{summary.output.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Wastage</p>
            <p className="text-lg font-black text-rose-600">{summary.wastage.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Station History</h3>
            <p className="text-xs text-slate-500 mt-1">Select a station to view batch-based logs and audit activity.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {stations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStation(item.id)}
                className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  station === item.id
                    ? 'bg-[#1A9A91] text-white shadow-sm'
                    : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loadingEvents ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-[#1A9A91]" />
              <p className="text-[10px] font-black uppercase tracking-widest">Loading station history...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="mt-3 text-sm font-bold text-slate-500">No {station.toLowerCase()} history found</p>
              <p className="mt-1 text-xs text-slate-400">Try another station filter.</p>
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[#1A9A91] shrink-0">
                      {event.source === 'MACHINE' ? <AlertTriangle className="h-5 w-5 text-rose-500" /> : <Activity className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{event.eventType?.replace(/_/g, ' ') || 'Production Event'}</p>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${eventClass(event.source)}`}>
                          {event.source || 'OPERATOR'}
                        </span>
                        <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                          {event.station || station}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 mt-1">{event.remarks || 'No remarks recorded.'}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.userName || 'System'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(event.loggedAt)}
                        </span>
                        {event.rawMaterialName && <span>Material: {event.rawMaterialName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:min-w-[440px]">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Output</p>
                      <p className="text-sm font-black text-slate-900">{formatNumber(event.primaryCount)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Wastage</p>
                      <p className="text-sm font-black text-rose-600">{formatNumber(event.wastageCount)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bags</p>
                      <p className="text-sm font-black text-slate-900">{formatNumber(event.bagsUsed)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Material</p>
                      <p className="text-sm font-black text-slate-900">
                        {formatNumber(event.preformUsage || event.capUsage || event.capBoxUsage || event.secondaryPackagingCount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {batch && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Brand</p>
            <p className="mt-1 text-sm font-black text-slate-900">{batch.brand?.name || 'Unknown Brand'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Started</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatDate(batch.startTime)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Quantity</p>
            <p className="mt-1 text-sm font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1A9A91]" />
              {Number(batch.targetQuantity || 0).toLocaleString()}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
