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

import { OperatorHeader } from './components/OperatorHeader';
import { StationWorkspace } from './components/StationWorkspace';
import { ActivityFeed } from './components/ActivityFeed';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Wind, PackageOpen, Zap, Box } from 'lucide-react';

export default function OperatorPanel() {
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, logout: authLogout } = useAuthStore();

  const stations = [
    {
      id: 'BLOWING', title: 'Blowing Station', materials: ['Preforms'], category: 'Preforms', icon: Wind, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100'
    },
    {
      id: 'FILLING', title: 'Filling Station', materials: ['Caps'], category: 'Caps', icon: PackageOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100'
    },
    {
      id: 'LABELING', title: 'Labeling Station', materials: ['Labels'], category: 'Labels', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100'
    },
    {
      id: 'PACKING', title: 'Packing Station', materials: ['Shrink Rolls', 'Cartons'], category: 'Shrink Rolls', icon: Box, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100'
    },
  ];

  const currentStationId = urlStation?.toUpperCase() || 'FILLING';
  const currentStation = stations.find(s => s.id === currentStationId) || stations[1];

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOperator, setActiveOperator] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);

  // Unified Entry State
  const [primaryCount, setPrimaryCount] = useState(0);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [secondaryPackagingCount, setSecondaryPackagingCount] = useState(0); // Bag/Box Count

  // Station Specific States
  const [preformUsage, setPreformUsage] = useState(0);
  const [capUsage, setCapUsage] = useState(0);
  const [labelUsage, setLabelUsage] = useState(0);
  const [shrinkUsage, setShrinkUsage] = useState('');
  const [casesProduced, setCasesProduced] = useState(0);
  const [phValue, setPhValue] = useState(0);
  const [tdsValue, setTdsValue] = useState(0);
  
  // New Label Station States
  const [labelStickerWeight, setLabelStickerWeight] = useState(0);
  const [damagedLabelWeight, setDamagedLabelWeight] = useState(0);
  const [inkChanged, setInkChanged] = useState(false);
  const [inkUsage, setInkUsage] = useState(0);
  const [makeupChanged, setMakeupChanged] = useState(false);
  const [makeupUsage, setMakeupUsage] = useState(0);
  
  // New Packing Station States
  const [shrinkWasteWeight, setShrinkWasteWeight] = useState('');

  const [testResult] = useState<'PASSED' | 'FAILED' | 'PENDING'>('PASSED');

  const [eventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  const [fromTime] = useState('');
  const [toTime] = useState('');

  const { data: batchData, isLoading: isLoadingBatch } = useQuery({
    queryKey: ['active-batch', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.PRODUCTION.ACTIVE_BATCH(lineId!))).data,
    enabled: !!lineId,
    refetchInterval: 15000,
    retry: 1
  });

  const activeBatch = batchData;

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
    onMutate: () => setIsLoggingOut(true),
    onSuccess: () => {
      api.post(ENDPOINTS.AUTH.LOGOUT)
        .catch(() => {})
        .finally(() => {
          setTimeout(() => authLogout(), 1200);
        });
    }
  });

  const changeStationMutation = useMutation({
    mutationFn: (station: string) => api.post(ENDPOINTS.OPERATOR_SESSIONS.CHANGE_STATION, { station }),
    onSuccess: (_, newStation) => {
      setShowStationModal(false);
      navigate(`/operator/workspace/${lineId}/${newStation.toLowerCase()}`, { replace: true });
      toast.success(`Station switched to ${newStation}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to switch station');
    }
  });

  const { data: line } = useQuery({
    queryKey: ['line', lineId],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.LINE(lineId!))).data,
    enabled: !!lineId,
    retry: 1
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

  useEffect(() => {
    if (!isLoadingBatch) {
      setLoading(false);
    }
  }, [isLoadingBatch]);

  // Enforce Formula: Used = Production + Wastage
  useEffect(() => {
    const total = primaryCount + rejectionCount;
    if (currentStationId === 'BLOWING') setPreformUsage(total);
    if (currentStationId === 'FILLING') setCapUsage(total);
    if (currentStationId === 'LABELING') setLabelUsage(total);
  }, [primaryCount, rejectionCount, currentStationId]);

  const handleSaveTelemetry = async (type: 'ALL' | 'COUNT' | 'EVENT' | 'WASTE' = 'ALL') => {
    if (!activeBatch?.batch) return toast.error('No active batch found.');
    if (isSubmitting) return;

    if (type === 'COUNT' && primaryCount === 0 && currentStation.id !== 'QC') return toast.error('Enter production count');

    const currentBatch = activeBatch?.batch;
    const logEntry: any = {
      requestId: uuidv4(),
      batchId: currentBatch?.id,
      sessionId: activeOperator?.sessionId || user?.sessionId || undefined,
      lineId: lineId!,
      brandId: currentBatch?.brandId,
      productId: currentBatch?.productId,
      shiftId: currentBatch?.shiftId,
      operatorId: activeOperator.id,
      operatorPin: activeOperator.currentPin,
      station: currentStation.id,
      primaryCount: Math.floor(primaryCount),
      wastageCount: Math.floor(rejectionCount), // Rejection and wastage consolidated
      secondaryPackagingCount: Math.floor(secondaryPackagingCount),
      eventType: type === 'EVENT' ? eventType : 'NORMAL_PRODUCTION',
      isRework: false,
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
      logEntry.capUsage = capUsage || (primaryCount + rejectionCount);
    } else if (currentStation.id === 'LABELING') {
      logEntry.bopRollUsage = labelUsage || (primaryCount + rejectionCount);
      logEntry.labelStickerWeight = labelStickerWeight;
      logEntry.damagedLabelWeight = damagedLabelWeight;
      logEntry.inkChanged = inkChanged;
      logEntry.inkUsageMl = inkChanged ? inkUsage : 0;
      logEntry.makeupChanged = makeupChanged;
      logEntry.makeupUsageMl = makeupChanged ? makeupUsage : 0;
    } else if (currentStation.id === 'PACKING') {
      logEntry.shrinkWeightUsed = parseFloat(shrinkUsage) || 0;
      logEntry.shrinkWasteWeight = parseFloat(shrinkWasteWeight) || 0;
      logEntry.sourceBatchNumber = activeBatch?.batch?.batchCode;
      logEntry.finishedGoodsProduced = primaryCount;
      logEntry.casesProduced = casesProduced;
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
      setPreformUsage(0); setCapUsage(0); setLabelUsage(0); setShrinkUsage('');
      setCasesProduced(0); setPhValue(0); setTdsValue(0);
      setLabelStickerWeight(0); setDamagedLabelWeight(0);
      setInkChanged(false); setInkUsage(0);
      setMakeupChanged(false); setMakeupUsage(0);
      setShrinkWasteWeight('');
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
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-all duration-500 animate-in fade-in">
          <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-2">Terminating Session</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Securing workspace and syncing ledger...</p>
        </div>
      )}

      <OperatorHeader
        lineName={line?.name || 'Line'}
        stationName={currentStation.title}
        operatorName={activeOperator?.name || 'Operator'}
        batchCode={activeBatch?.batch?.batchCode}
        productName={activeBatch?.productName}
        machineStatus={machineStatus}
        isLoggingOut={isLoggingOut}
        onChangeStation={() => setShowStationModal(true)}
        onLogout={() => endSessionMutation.mutate()}
        onDowntime={() => toast.info('Downtime Modal: Coming Soon')}
      />

      <StationWorkspace
        title={currentStation.title}
        description="Production Data Processing Node"
        sidebar={<ActivityFeed history={history || []} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Action Card */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm space-y-10">
            <div className="space-y-6">
              <IndustrialNumericInput
                label={`${currentStation.id === 'PACKING' ? 'Finished Goods' : 'Production Unit'} Count`}
                value={primaryCount}
                onChange={setPrimaryCount}
                suffix="Units"
              />

              <div className="flex flex-col gap-6">
                {currentStation.id !== 'PACKING' && (
                  <IndustrialNumericInput
                    label="Rejects / Waste"
                    value={rejectionCount}
                    onChange={setRejectionCount}
                    suffix="Units"
                  />
                )}
                
                {currentStation.id === 'BLOWING' && (
                  <div className="space-y-1">
                    <IndustrialNumericInput
                      label="Preforms Used (This Log)"
                      value={preformUsage}
                      onChange={() => {}} 
                      suffix="Pcs"
                      readOnly
                    />
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2">
                      Batch Total: <span className="text-slate-900">{(activeBatch as any)?.materialTotals?.preformTotal || 0} PCS</span>
                    </p>
                  </div>
                )}
                
                {currentStation.id === 'FILLING' && (
                  <div className="space-y-1">
                    <IndustrialNumericInput
                      label="Caps Used (This Log)"
                      value={capUsage}
                      onChange={() => {}}
                      suffix="Pcs"
                      readOnly
                    />
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2">
                      Batch Total: <span className="text-slate-900">
                        {((activeBatch as any)?.materialTotals?.capTotal || 0)} PCS
                      </span>
                    </p>
                  </div>
                )}
                
                {currentStation.id === 'LABELING' && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <IndustrialNumericInput
                        label="Labels Used (This Log)"
                        value={labelUsage}
                        onChange={() => {}}
                        suffix="Pcs"
                        readOnly
                      />
                    </div>
                    <IndustrialNumericInput label="Label Sticker Weight" value={labelStickerWeight} onChange={setLabelStickerWeight} suffix="g" />
                    <IndustrialNumericInput label="Damaged Label Waste" value={damagedLabelWeight} onChange={setDamagedLabelWeight} suffix="g" />
                    
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={inkChanged} onChange={e => setInkChanged(e.target.checked)} className="w-5 h-5 rounded text-indigo-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">Ink Consumable Changed</span>
                      </label>
                      {inkChanged && <IndustrialNumericInput label="Ink Usage" value={inkUsage} onChange={setInkUsage} suffix="ml" />}
                      
                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input type="checkbox" checked={makeupChanged} onChange={e => setMakeupChanged(e.target.checked)} className="w-5 h-5 rounded text-indigo-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">Make-up Consumable Changed</span>
                      </label>
                      {makeupChanged && <IndustrialNumericInput label="Make-up Usage" value={makeupUsage} onChange={setMakeupUsage} suffix="ml" />}
                    </div>
                  </div>
                )}
                
                {currentStation.id === 'PACKING' && (
                  <div className="space-y-6">
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-2">Production Source Batch</label>
                      <input type="text" value={activeBatch?.batch?.batchCode || 'N/A'} readOnly className="w-full bg-slate-200 border-none rounded-lg px-4 py-3 text-slate-500 font-bold font-mono outline-none cursor-not-allowed" />
                    </div>
                    
                    <IndustrialNumericInput label="Cases Produced" value={casesProduced} onChange={setCasesProduced} suffix="Cases" />
                    <div className="opacity-50 pointer-events-none">
                      <IndustrialNumericInput label="Total Bottles (Calculated)" value={primaryCount} onChange={() => {}} suffix="Bottles" readOnly />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Shrink Material Used (g)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={shrinkUsage}
                          onChange={e => setShrinkUsage(e.target.value)}
                          placeholder="e.g. 1.256"
                          className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-6 pr-12 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/30 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">g</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Shrink Material Waste (g)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={shrinkWasteWeight}
                          onChange={e => setShrinkWasteWeight(e.target.value)}
                          placeholder="e.g. 0.124"
                          className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-6 pr-12 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/30 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">g</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

      <Dialog open={showStationModal} onOpenChange={setShowStationModal}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader className="space-y-4 mb-6">
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Change <span className="text-indigo-600">Station</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Select a new process node on {line?.name || 'this line'}. Your session will seamlessly transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stations.map(station => {
              const isActive = station.id === currentStationId;
              const isSwitching = changeStationMutation.isPending && changeStationMutation.variables === station.id;
              
              return (
                <button
                  key={station.id}
                  disabled={isActive || changeStationMutation.isPending}
                  onClick={() => changeStationMutation.mutate(station.id)}
                  className={`group p-6 rounded-2xl border transition-all text-left flex items-center gap-4 ${
                    isActive 
                      ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${station.bg} ${station.border}`}>
                    <station.icon className={`w-6 h-6 ${station.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black uppercase text-slate-900">{station.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {isActive ? 'Current Node' : 'Switch Context'}
                    </p>
                  </div>
                  {isSwitching && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowStationModal(false)}
              className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
