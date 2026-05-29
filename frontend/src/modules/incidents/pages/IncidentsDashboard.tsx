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
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';
import useAuthStore from '../../auth/auth.store';

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

const stations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC'];
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
const filterClass = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none transition focus:border-[#1A9A91]/50 focus:ring-4 focus:ring-[#1A9A91]/10';

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
    <div className={`${isOperatorView ? 'min-h-screen bg-[#F8FAFC] p-4 sm:p-6' : ''}`}>
      <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#1A9A91]/10 border border-[#1A9A91]/20 flex items-center justify-center text-[#1A9A91] shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Incidents & Maintenance</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">Operational interruptions, maintenance response, and downtime history.</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="h-10 px-4 rounded-lg bg-[#1A9A91] text-white text-xs font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Report Issue
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Metric label="Open Incidents" value={summary.open || 0} icon={AlertTriangle} />
        <Metric label="Critical" value={summary.critical || 0} icon={ShieldAlert} />
        <Metric label="Factory" value={summary.factory || 0} icon={Wrench} />
        <Metric label="Avg Resolution" value={fmtMinutes(summary.avgResolution)} icon={Clock} />
        <Metric label="Downtime" value={fmtMinutes(summary.downtime)} icon={TimerReset} />
      </div>

      {showCreate && (
        <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
              <span className={`px-2 py-1 rounded-md border ${priorityClass[selectedType.priority]}`}>{selectedType.priority}</span>
              <span className="px-2 py-1 rounded-md border border-slate-200 text-slate-500">{selectedType.selfResolvable ? 'Self Resolvable' : 'Manager Required'}</span>
              <span className="px-2 py-1 rounded-md border border-slate-200 text-slate-500">{selectedType.productionImpact ? 'Starts Downtime' : 'No Downtime'}</span>
            </div>
          )}
          <button disabled={!form.incidentTypeId || createMutation.isPending} onClick={() => createMutation.mutate()} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
            {createMutation.isPending ? 'Reporting...' : 'Commit Incident'}
          </button>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#1A9A91]" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Incident Register</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filters.status} onChange={event => setFilters(prev => ({ ...prev, status: event.target.value }))} className={filterClass}><option value="">All Status</option>{Object.keys(statusClass).map(v => <option key={v}>{v}</option>)}</select>
            <select value={filters.priority} onChange={event => setFilters(prev => ({ ...prev, priority: event.target.value }))} className={filterClass}><option value="">All Priority</option>{Object.keys(priorityClass).map(v => <option key={v}>{v}</option>)}</select>
            <select value={filters.lineId} onChange={event => setFilters(prev => ({ ...prev, lineId: event.target.value }))} className={filterClass}><option value="">All Lines</option>{lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}</select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#1A9A91]" /></div>
        ) : incidents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm font-bold">No incidents found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incidents.map(incident => (
              <div key={incident.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{incident.incidentNumber}</p>
                      <span className={`px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest ${priorityClass[incident.priority]}`}>{incident.priority}</span>
                      <span className={`px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest ${statusClass[incident.status]}`}>{incident.status}</span>
                      {incident.productionImpact && <span className="px-2 py-1 rounded-md border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">Downtime</span>}
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-700">{incident.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {incident.incidentTypeName} • {incident.lineName || 'Factory'} {incident.stationId ? `• ${incident.stationId}` : ''} • Reported by {incident.reportedByName || 'System'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visibleNextStatuses(incident).map(status => (
                      <button key={status} disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: incident.id, status })} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {maintenance.map((item: any) => (
          <div key={item.typeName} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-[#1A9A91]" />
              <p className="text-sm font-black text-slate-900">{item.typeName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <TinyMetric label="Changes" value={item.occurrences} />
              <TinyMetric label="Avg Time" value={fmtMinutes(item.averageDuration)} />
              <TinyMetric label="Total Lost" value={fmtMinutes(item.totalDowntime)} />
              <TinyMetric label="Slowest" value={fmtMinutes(item.slowest)} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-[#1A9A91]" />
      </div>
    </div>
  );
}

function TinyMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
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
