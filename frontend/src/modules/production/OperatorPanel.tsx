import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import useAuthStore from '../auth/auth.store';
import {
  Loader2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { api } from '../../services/api-client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IndustrialNumericInput } from '../../components/ui/industrial-numeric-input';
import { TerminalLogin } from './components/TerminalLogin';
import { ENDPOINTS } from '../../constants/endpoints';

// New Atomic Components
import { OperatorHeader } from './components/OperatorHeader';
import { StationWorkspace } from './components/StationWorkspace';
import { ActivityFeed } from './components/ActivityFeed';

export default function OperatorPanel() {
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const stations = [
    {
      id: 'BLOWING', title: 'Blowing Station', materials: ['Preforms'], category: 'Preforms'
    },
    {
      id: 'FILLING', title: 'Filling Station', materials: ['Caps'], category: 'Caps'
    },
    {
      id: 'LABELING', title: 'Labeling Station', materials: ['Labels'], category: 'Labels'
    },
    {
      id: 'PACKING', title: 'Packing Station', materials: ['Shrink Rolls', 'Cartons'], category: 'Shrink Rolls'
    },
  ];

  const { data: session, isLoading: isLoadingSession } = useQuery({
    queryKey: ['current-operator-session'],
    queryFn: async () => (await api.get(ENDPOINTS.OPERATOR_SESSIONS.CURRENT)).data,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const currentStationId = urlStation?.toUpperCase() || session?.station || 'FILLING';
  const currentStation = stations.find(s => s.id === currentStationId) || stations[1];

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOperator, setActiveOperator] = useState<any>(null);

  // Unified Entry State
  const [primaryCount, setPrimaryCount] = useState(0);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [secondaryPackagingCount, setSecondaryPackagingCount] = useState(0); // Bag/Box Count

  // Station Specific States
  const [preformUsage, setPreformUsage] = useState(0);
  const [capUsage, setCapUsage] = useState(0);
  const [labelUsage, setLabelUsage] = useState(0);
  const [shrinkUsage, setShrinkUsage] = useState(0);
  const [casesProduced, setCasesProduced] = useState(0);
  const [phValue, setPhValue] = useState(0);
  const [tdsValue, setTdsValue] = useState(0);
  const [inkUsage, setInkUsage] = useState(0);
  const [solventUsage, setSolventUsage] = useState(0);
  const [testResult] = useState<'PASSED' | 'FAILED' | 'PENDING'>('PASSED');

  const [eventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  const [fromTime] = useState('');
  const [toTime] = useState('');

  // Enterprise & Inventory State
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [packingConfigId, setPackingConfigId] = useState<string>('');

  const { data: batchData, isLoading: isLoadingBatch } = useQuery({
    queryKey: ['active-batch', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.ACTIVE_BATCH(lineId!))).data,
    enabled: !!lineId,
    refetchInterval: 15000,
    retry: 1
  });

  const activeBatch = batchData;

  const { data: inventory } = useQuery({
    queryKey: ['station-inventory', currentStationId],
    queryFn: async () => (await api.get(ENDPOINTS.INVENTORY.STOCK_BY_CATEGORY(currentStation.category || 'Raw Materials'))).data,
    enabled: !!currentStation.category
  });

  const { data: activeEvents } = useQuery({
    queryKey: ['active-downtime-events', activeBatch?.batch?.id],
    queryFn: async () => {
      if (!activeBatch?.batch?.id) return [];
      return (await api.get(ENDPOINTS.TELEMETRY.ACTIVE_EVENTS(activeBatch.batch.id))).data;
    },
    enabled: !!activeBatch?.batch?.id,
    refetchInterval: 30000
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.post(ENDPOINTS.OPERATOR_SESSIONS.END),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-operator-session'] });
      if (location.pathname.startsWith('/operator')) {
        navigate('/operator/select');
      } else {
        navigate('/line/select');
      }
    }
  });

  const { data: line } = useQuery({
    queryKey: ['line', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINE(lineId!))).data,
    enabled: !!lineId,
    retry: 1
  });

  const { data: packingConfigs } = useQuery({
    queryKey: ['packing-configs', activeBatch?.batch?.productId],
    queryFn: async () => {
      if (!activeBatch?.batch?.productId) return [];
      return (await api.get(ENDPOINTS.INVENTORY.PACKAGING(activeBatch.batch.productId))).data;
    },
    enabled: !!activeBatch?.batch?.productId
  });

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['station-log-history', activeBatch?.batch?.id, currentStation.id],
    queryFn: async () => {
      if (!activeBatch?.batch?.id) return [];
      return (await api.get(ENDPOINTS.TELEMETRY.HISTORY(activeBatch.batch.id, currentStation.id))).data;
    },
    enabled: !!activeBatch?.batch?.id,
  });

  useEffect(() => {
    if (location.pathname.startsWith('/operator/workspace') && user && !activeOperator) {
      setActiveOperator(user);
    }
  }, [location, user, activeOperator]);

  // Heartbeat to keep session active
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      try {
        await api.post(ENDPOINTS.OPERATOR_SESSIONS.HEARTBEAT);
      } catch (err) {
        console.warn('[SESSION_HEARTBEAT_FAILED]', err);
      }
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!isLoadingSession && !session) {
      if (location.pathname.includes('/workspace')) {
        toast.error('Session ended or taken over by another device.');
      }

      if (location.pathname.startsWith('/operator')) {
        navigate('/operator/select');
      } else {
        navigate('/line/select');
      }
    }
  }, [session, isLoadingSession, navigate, location]);

  useEffect(() => {
    if (!isLoadingBatch && !isLoadingSession) {
      setLoading(false);
    }
  }, [isLoadingBatch, isLoadingSession]);

  const handleSaveTelemetry = async (type: 'ALL' | 'COUNT' | 'EVENT' | 'WASTE' = 'ALL') => {
    if (!activeBatch?.batch && !session?.batchId) return toast.error('No active batch found.');
    if (isSubmitting) return;

    if (type === 'COUNT' && primaryCount === 0 && currentStation.id !== 'QC') return toast.error('Enter production count');
    if ((type === 'ALL' || type === 'COUNT') && !selectedStockId && currentStation.id !== 'PACKING' && currentStation.id !== 'QC') {
      return toast.error('MATERIAL_BATCH_REQUIRED: Select stock batch.');
    }

    const currentBatch = activeBatch?.batch;
    const logEntry: any = {
      requestId: uuidv4(),
      batchId: currentBatch?.id || session?.batchId,
      sessionId: session?.id,
      lineId: lineId!,
      brandId: currentBatch?.brandId || session?.brandId,
      productId: currentBatch?.productId || session?.productId,
      shiftId: currentBatch?.shiftId || session?.shiftId,
      operatorId: activeOperator.id,
      operatorPin: activeOperator.currentPin,
      station: currentStation.id,
      primaryCount: Math.floor(primaryCount),
      wastageCount: Math.floor(rejectionCount), // Rejection and wastage consolidated
      secondaryPackagingCount: Math.floor(secondaryPackagingCount),
      eventType: type === 'EVENT' ? eventType : 'NORMAL_PRODUCTION',
      isRework: false,
      selectedStockId,
      remarks: type === 'EVENT' ? remarks : '',
      fromTime: type === 'EVENT' ? fromTime : undefined,
      toTime: type === 'EVENT' ? toTime : undefined,
      loggedAt: new Date().toISOString()
    };

    if (currentStation.id === 'BLOWING') {
      // For Blowing, we purchase in KGs but produce in COUNT.
      // We track 'preformsUsed' as the count of preforms consumed.
      logEntry.preformUsage = preformUsage || (primaryCount + rejectionCount);
    } else if (currentStation.id === 'FILLING') {
      logEntry.capUsage = capUsage || primaryCount;
    } else if (currentStation.id === 'LABELING') {
      logEntry.bopRollUsage = labelUsage || primaryCount;
      logEntry.inkUsage = inkUsage;
      logEntry.solventUsage = solventUsage;
    } else if (currentStation.id === 'PACKING') {
      logEntry.shrinkWeightUsed = shrinkUsage;
      logEntry.finishedGoodsProduced = primaryCount;
      logEntry.casesProduced = casesProduced;
      logEntry.packingTypeId = packingConfigId;
    } else if (currentStation.id === 'QC') {
      logEntry.phValue = phValue;
      logEntry.tdsValue = tdsValue;
      logEntry.testResult = testResult;
    }

    try {
      setIsSubmitting(true);
      await api.post(ENDPOINTS.TELEMETRY.LOGS, logEntry);
      toast.success('Log Successfully Transmitted');

      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ['active-batch'] });

      setPrimaryCount(0); setRejectionCount(0); setSecondaryPackagingCount(0);
      setPreformUsage(0); setCapUsage(0); setLabelUsage(0); setShrinkUsage(0);
      setCasesProduced(0); setPhValue(0); setTdsValue(0);
    } catch (err: any) {
      toast.error('Failed to transmit log. Node error.');
    } finally { setIsSubmitting(false); }
  };

  if (!activeOperator) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <TerminalLogin
            lineId={lineId!}
            lineName={line?.name}
            station={currentStationId}
            onSuccess={(op: any) => setActiveOperator(op)}
            onClose={() => navigate('/operator/select')}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Initializing OS...</p>
      </div>
    );
  }

  const machineStatus = (activeEvents?.length > 0) ? 'ERROR' : (activeBatch?.batch?.status === 'RUNNING' ? 'RUNNING' : 'IDLE');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
      <OperatorHeader
        lineName={line?.name || 'Line'}
        stationName={currentStation.title}
        operatorName={activeOperator?.name || 'Operator'}
        batchCode={activeBatch?.batch?.batchCode}
        productName={activeBatch?.productName}
        machineStatus={machineStatus}
        onLogout={() => endSessionMutation.mutate()}
        onDowntime={() => toast.info('Downtime Modal: Coming Soon')}
      />

      <StationWorkspace
        title={currentStation.title}
        description="Production Data Processing Node"
        sidebar={<ActivityFeed history={history || []} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Action Card */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-10">
            <div className="space-y-6">
              <IndustrialNumericInput
                label={`${currentStation.id === 'PACKING' ? 'Finished Goods' : 'Production Unit'} Count`}
                value={primaryCount}
                onChange={setPrimaryCount}
                suffix="Units"
              />

              <div className="grid grid-cols-2 gap-6">
                <IndustrialNumericInput
                  label="Rejects / Waste"
                  value={rejectionCount}
                  onChange={setRejectionCount}
                  suffix="Units"
                />
                {currentStation.id === 'BLOWING' ? (
                  <IndustrialNumericInput
                    label="Preforms Used"
                    value={preformUsage}
                    onChange={setPreformUsage}
                    suffix="Pcs"
                  />
                ) : (
                  <IndustrialNumericInput
                    label="Bags / Boxes Completed"
                    value={secondaryPackagingCount}
                    onChange={setSecondaryPackagingCount}
                    suffix="Units"
                  />
                )}
              </div>

              {currentStation.id === 'LABELING' && (
                <div className="grid grid-cols-2 gap-6">
                  <IndustrialNumericInput label="Ink (g)" value={inkUsage} onChange={setInkUsage} />
                  <IndustrialNumericInput label="Solvent (g)" value={solventUsage} onChange={setSolventUsage} />
                </div>
              )}
            </div>

            <button
              onClick={() => handleSaveTelemetry('ALL')}
              disabled={isSubmitting}
              className="w-full h-20 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-4 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Layers size={20} />}
              Commit to Ledger
            </button>
          </div>

          {/* Secondary Control Card */}
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Process Logistics</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Material Source Batch</label>
                  <select
                    value={selectedStockId}
                    onChange={(e) => setSelectedStockId(e.target.value)}
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/30 transition-all"
                  >
                    <option value="">Select Stock Batch...</option>
                    {inventory?.map((item: any) => (
                      <option key={item.id} value={item.id}>
                        {item.itemName} ({item.quantity} {item.unit}) • {item.quantity} Bags/Items
                      </option>
                    ))}
                  </select>
                </div>

                {currentStation.id === 'PACKING' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Packing Config</label>
                    <select
                      value={packingConfigId}
                      onChange={(e) => setPackingConfigId(e.target.value)}
                      className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/30 transition-all"
                    >
                      <option value="">Select Config...</option>
                      {packingConfigs?.map((config: any) => (
                        <option key={config.id} value={config.id}>{config.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-[2rem] p-8">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-amber-600" size={18} />
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest">Anomaly Signature</h4>
              </div>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Describe machine event or stop reason..."
                className="w-full h-32 bg-white border border-amber-200 rounded-xl p-4 text-xs font-bold text-slate-700 placeholder:text-amber-900/30 outline-none focus:border-amber-500/50 transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </StationWorkspace>
    </div>
  );
}
