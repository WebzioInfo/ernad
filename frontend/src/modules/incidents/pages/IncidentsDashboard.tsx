import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Filter,
  Image,
  Loader2,
  Plus,
  ShieldAlert,
  TimerReset,
  Wrench,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';
import useAuthStore from '../../auth/auth.store';
import ConfirmationModal from '../../../components/common/ConfirmationModal';

type Category = 'FACTORY' | 'LINE' | 'STATION';
type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type Status = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface IncidentType {
  id: string;
  name: string;
  category: Category;
  priority: Priority;
  selfResolvable: boolean;
  productionImpact: boolean;
  defaultSlaMinutes: number;
}

interface Incident {
  id: string;
  incidentNumber: string;
  title: string;
  description?: string;
  category: Category;
  lineId?: string;
  lineName?: string;
  stationId?: string;
  incidentTypeId: string;
  incidentTypeName: string;
  priority: Priority;
  status: Status;
  reportedByName?: string;
  openedAt: string;
  durationMinutes?: number;
  productionImpact: boolean;
}

const stations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING'];
const statusFlow: Status[] = ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const priorityClass: Record<Priority, string> = {
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-100',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-100',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-100',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const statusClass: Record<Status, string> = {
  OPEN: 'bg-rose-50 text-rose-700 border-rose-100',
  ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-100',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const fmtMinutes = (value?: number) => `${Math.round(Number(value || 0))}m`;
const controlClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-[#1A9A91]/50 focus:ring-4 focus:ring-[#1A9A91]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const filterClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none transition focus:border-[#1A9A91]/50 focus:ring-4 focus:ring-[#1A9A91]/10 xl:w-auto';

export default function IncidentsDashboard() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const role = String(user?.role || '').toUpperCase();
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const initialLineId = searchParams.get('lineId') || '';
  const initialStationId = searchParams.get('stationId') || 'LABELING';

  const [filters, setFilters] = useState({ status: '', priority: '', category: '', lineId: initialLineId, stationId: initialStationId });
  const [showCreate, setShowCreate] = useState(searchParams.get('report') === '1');
  const [form, setForm] = useState({
    incidentTypeId: '',
    category: 'STATION' as Category,
    title: '',
    description: '',
    lineId: initialLineId,
    stationId: initialStationId,
    beforeImageUrl: '',
  });

  const [pendingStatusChange, setPendingStatusChange] = useState<{id: string, status: Status} | null>(null);
  const [pendingIncidentCreate, setPendingIncidentCreate] = useState(false);

  const { data: incidentTypes = [] } = useQuery<IncidentType[]>({
    queryKey: ['incident-types', form.category],
    queryFn: async () => (await api.get(ENDPOINTS.INCIDENTS.TYPES, { params: { category: form.category } })).data,
  });

  const { data: lines = [] } = useQuery<any[]>({
    queryKey: ['master-data-lines'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINES)).data,
  });

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ['incidents', filters],
    queryFn: async () => (await api.get(ENDPOINTS.INCIDENTS.LIST, { params: filters })).data,
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ['incident-analytics', filters.lineId, filters.stationId],
    queryFn: async () => (await api.get(ENDPOINTS.INCIDENTS.ANALYTICS, { params: { lineId: filters.lineId, stationId: filters.stationId } })).data,
  });

  const factoryQuery = useQuery({
    queryKey: ['factory-live-incidents'],
    queryFn: async () => (await api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE)).data,
    refetchInterval: 30000,
  });

  const selectedType = incidentTypes.find((type) => type.id === form.incidentTypeId);

  const createMutation = useMutation({
    mutationFn: async () => api.post(ENDPOINTS.INCIDENTS.CREATE, {
      ...form,
      title: form.title || selectedType?.name,
      productionImpact: selectedType?.productionImpact,
    }),
    onSuccess: () => {
      toast.success('Incident reported');
      setShowCreate(false);
      setForm(prev => ({ ...prev, title: '', description: '', beforeImageUrl: '' }));
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-analytics'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => api.patch(ENDPOINTS.INCIDENTS.STATUS(id), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-analytics'] });
    },
  });

  const summary = analytics?.summary || {};
  const maintenance = analytics?.maintenance || [];
  const isOperatorView = role === 'OPERATOR';

  const visibleNextStatuses = useMemo(() => {
    return (incident: Incident) => statusFlow.filter(status => {
      if (incident.status === 'CLOSED') return false;
      if (!isManager && status !== 'RESOLVED') return false;
      return true;
    });
  }, [isManager]);

  return (
    <div className={`${isOperatorView ? 'min-h-screen' : 'min-h-full'} bg-[#F8FAFC] p-4 sm:p-6`}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1A9A91]/20 bg-[#1A9A91]/10 text-[#1A9A91]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black tracking-tight text-slate-900">Incidents & Maintenance</h2>
              <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">Operational interruptions, maintenance response, and downtime history.</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1A9A91] px-4 text-xs font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-[#157C75] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Report Issue
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Open Incidents" value={summary.open || 0} icon={AlertTriangle} />
          <Metric label="Critical" value={summary.critical || 0} icon={ShieldAlert} />
          <Metric label="Factory" value={summary.factory || 0} icon={Wrench} />
          <Metric label="Avg Resolution" value={fmtMinutes(summary.avgResolution)} icon={Clock} />
          <Metric label="Downtime" value={fmtMinutes(summary.downtime)} icon={TimerReset} />
        </div>

        {showCreate && (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Level">
                <select value={form.category} onChange={event => setForm(prev => ({ ...prev, category: event.target.value as Category, incidentTypeId: '' }))} className={controlClass}>
                  <option value="FACTORY">Factory</option>
                  <option value="LINE">Line</option>
                  <option value="STATION">Station</option>
                </select>
              </Field>
              <Field label="Incident Type">
                <select value={form.incidentTypeId} onChange={event => setForm(prev => ({ ...prev, incidentTypeId: event.target.value }))} className={controlClass}>
                  <option value="">Select type</option>
                  {incidentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </Field>
              <Field label="Line">
                <select disabled={form.category === 'FACTORY'} value={form.lineId} onChange={event => setForm(prev => ({ ...prev, lineId: event.target.value }))} className={controlClass}>
                  <option value="">Select line</option>
                  {lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
                </select>
              </Field>
              <Field label="Station">
                <select disabled={form.category !== 'STATION'} value={form.stationId} onChange={event => setForm(prev => ({ ...prev, stationId: event.target.value }))} className={controlClass}>
                  {stations.map(station => <option key={station} value={station}>{station}</option>)}
                </select>
              </Field>
              <Field label="Title">
                <input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder={selectedType?.name || 'Optional custom title'} className={controlClass} />
              </Field>
              <Field label="Before Image URL">
                <input value={form.beforeImageUrl} onChange={event => setForm(prev => ({ ...prev, beforeImageUrl: event.target.value }))} placeholder="Optional evidence URL" className={controlClass} />
              </Field>
            </div>
            <textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Describe the issue, machine state, evidence, or maintenance action..." className={`${controlClass} min-h-[88px] py-3`} />
            {selectedType && (
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className={`rounded-md border px-2 py-1 ${priorityClass[selectedType.priority]}`}>{selectedType.priority}</span>
                <span className="rounded-md border border-slate-200 px-2 py-1 text-slate-500">{selectedType.selfResolvable ? 'Self Resolvable' : 'Manager Required'}</span>
                <span className="rounded-md border border-slate-200 px-2 py-1 text-slate-500">{selectedType.productionImpact ? 'Starts Downtime' : 'No Downtime'}</span>
              </div>
            )}
            <div className="flex justify-end">
              <button disabled={!form.incidentTypeId || createMutation.isPending} onClick={() => setPendingIncidentCreate(true)} className="h-10 w-full rounded-lg bg-slate-900 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto">
                {createMutation.isPending ? 'Reporting...' : 'Commit Incident'}
              </button>
            </div>
          </section>
        )}

        {factoryQuery.data?.activeDowntimes?.length > 0 && (
          <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-rose-600 animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-widest text-rose-900">Critical Active Machine Stops</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {factoryQuery.data.activeDowntimes.map((stop: any) => (
                <div key={stop.id} className="bg-white p-3 rounded-lg border border-rose-100 flex items-center gap-3 shadow-sm hover:border-rose-300 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 uppercase truncate">Stop: {stop.reason?.replace('_', ' ')}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">{stop.line || 'Unknown Line'} • {stop.station}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-4 w-4 text-[#1A9A91]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Incident Register</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap xl:justify-end">
              <select value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))} className={filterClass}><option value="">All Status</option>{Object.keys(statusClass).map(v => <option key={v}>{v}</option>)}</select>
              <select value={filters.priority} onChange={event => setFilters(prev => ({ ...prev, priority: event.target.value }))} className={filterClass}><option value="">All Priority</option>{Object.keys(priorityClass).map(v => <option key={v}>{v}</option>)}</select>
              <select value={filters.lineId} onChange={event => setFilters(prev => ({ ...prev, lineId: event.target.value }))} className={filterClass}><option value="">All Lines</option>{lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}</select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#1A9A91]" /></div>
          ) : incidents.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">No incidents found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidents.map(incident => (
                <div key={incident.id} className="p-4 transition-colors hover:bg-slate-50/70">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{incident.incidentNumber}</p>
                        <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${priorityClass[incident.priority]}`}>{incident.priority}</span>
                        <span className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass[incident.status]}`}>{incident.status}</span>
                        {incident.productionImpact && <span className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Downtime</span>}
                      </div>
                      <p className="mt-2 break-words text-sm font-bold leading-5 text-slate-700">{incident.title}</p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {incident.incidentTypeName} - {incident.lineName || 'Factory'} {incident.stationId ? `- ${incident.stationId}` : ''} - Reported by {incident.reportedByName || 'System'}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 xl:w-auto xl:justify-end">
                      {visibleNextStatuses(incident).map(status => (
                        <button key={status} disabled={statusMutation.isPending} onClick={() => setPendingStatusChange({ id: incident.id, status })} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                          {status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {maintenance.map((item: any) => (
            <div key={item.typeName} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-[#1A9A91]" />
                <p className="text-sm font-black text-slate-900">{item.typeName}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <TinyMetric label="Changes" value={item.occurrences} />
                <TinyMetric label="Avg Time" value={fmtMinutes(item.averageDuration)} />
                <TinyMetric label="Total Lost" value={fmtMinutes(item.totalDowntime)} />
                <TinyMetric label="Slowest" value={fmtMinutes(item.slowest)} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <ConfirmationModal
        isOpen={pendingIncidentCreate}
        onClose={() => setPendingIncidentCreate(false)}
        onConfirm={() => {
          createMutation.mutate();
          setPendingIncidentCreate(false);
        }}
        title="Report Incident"
        message="Are you sure you want to report this incident? Please ensure all details are accurate."
        confirmText="Yes, Report"
        variant="primary"
      />

      <ConfirmationModal
        isOpen={!!pendingStatusChange}
        onClose={() => setPendingStatusChange(null)}
        onConfirm={() => {
          if (pendingStatusChange) {
            statusMutation.mutate(pendingStatusChange);
            setPendingStatusChange(null);
          }
        }}
        title="Update Incident Status"
        message={`Are you sure you want to change the status to ${pendingStatusChange?.status.replace('_', ' ')}?`}
        confirmText="Yes, Update"
        variant="primary"
      />
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-900">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-[#1A9A91]" />
      </div>
    </div>
  );
}

function TinyMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}
