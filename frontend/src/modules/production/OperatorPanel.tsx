import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../auth/auth.store';
import {
  Loader2,
  AlertTriangle,
  Layers,
  History,
  X,
  Play,
  RefreshCcw
} from 'lucide-react';
import { api } from '../../services/api-client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IndustrialNumericInput } from '../../components/ui/industrial-numeric-input';
import { TerminalLogin } from './components/TerminalLogin';
import { ENDPOINTS } from '../../constants/endpoints';

import { OperatorHeader } from './components/OperatorHeader';
import { StationWorkspace } from './components/StationWorkspace';
import { ActivityFeed } from './components/ActivityFeed';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Wind, PackageOpen, Zap, Box } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

const bottleConfigs = [
  { id: '6_2L', label: '6 - 2L', multiplier: 6 },
  { id: '12_1L', label: '12 - 1L', multiplier: 12 },
  { id: '24_500ML', label: '24 - 500ML', multiplier: 24 },
  { id: '35_300ML', label: '35 - 300ML', multiplier: 35 },
];

export default function OperatorPanel() {
  const { id: lineId, station: urlStation } = useParams<{ id: string, station: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, logout: authLogout } = useAuthStore();

  // Initialize line-specific WebSocket connections
  useWebSocket(lineId);

  const stations = [
    {
      id: 'BLOWING', title: 'Blowing Station', materials: ['Preforms'], category: 'Preforms', icon: Wind, color: 'text-[#1A9A91]', bg: 'bg-[#1A9A91]/5', border: 'border-[#1A9A91]/20'
    },
    {
      id: 'FILLING', title: 'Filling Station', materials: ['Caps'], category: 'Caps', icon: PackageOpen, color: 'text-[#1A9A91]', bg: 'bg-[#1A9A91]/5', border: 'border-[#1A9A91]/20'
    },
    {
      id: 'LABELING', title: 'Labeling Station', materials: ['Labels'], category: 'Labels', icon: Zap, color: 'text-[#1A9A91]', bg: 'bg-[#1A9A91]/5', border: 'border-[#1A9A91]/20'
    },
    {
      id: 'PACKING', title: 'Packing Station', materials: ['Shrink Rolls', 'Cartons'], category: 'Shrink Rolls', icon: Box, color: 'text-[#1A9A91]', bg: 'bg-[#1A9A91]/5', border: 'border-[#1A9A91]/20'
    },
  ];

  const currentStationId = urlStation?.toUpperCase() || 'FILLING';
  const currentStation = stations.find(s => s.id === currentStationId) || stations[1];

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOperator, setActiveOperator] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);

  // Shift Handover States
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [incomingOperatorId, setIncomingOperatorId] = useState('');
  const [incomingOperatorPin, setIncomingOperatorPin] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverIssues, setHandoverIssues] = useState('');
  const [materialStateConfirmed, setMaterialStateConfirmed] = useState(false);
  const [machineStatusAcknowledged, setMachineStatusAcknowledged] = useState(false);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  // Unified Entry State
  const [primaryCount, setPrimaryCount] = useState(0);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [secondaryPackagingCount, setSecondaryPackagingCount] = useState(0); // Bag/Box Count
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Filling station wastage toggle & inputs
  const [productionWastages, setProductionWastages] = useState(false);
  const [bottleLeakage, setBottleLeakage] = useState(0);
  const [capWastage, setCapWastage] = useState(0);
  const [rawProductionCount, setRawProductionCount] = useState(0);

  // Station Specific States
  const [selectedCapRawMaterialId, setSelectedCapRawMaterialId] = useState('');
  const [selectedRawMaterialId, setSelectedRawMaterialId] = useState('');
  const [bagsUsed, setBagsUsed] = useState(0);
  const [preformUsage, setPreformUsage] = useState(0);
  const [capUsage, setCapUsage] = useState(0);
  const [capBoxUsage, setCapBoxUsage] = useState(0);
  const [labelUsage, setLabelUsage] = useState(0);
  const [shrinkUsage, setShrinkUsage] = useState('');
  const [casesProduced, setCasesProduced] = useState(0);
  const [phValue, setPhValue] = useState(0);
  const [tdsValue, setTdsValue] = useState(0);
  
  // Label station states
  const [inkChanged, setInkChanged] = useState(false);
  const [makeupChanged, setMakeupChanged] = useState(false);
  
  // New Packing Station States
  const [shrinkWasteWeight, setShrinkWasteWeight] = useState('');
  const [selectedBottleConfig, setSelectedBottleConfig] = useState<string>('');
  const [testResult] = useState<'PASSED' | 'FAILED' | 'PENDING'>('PASSED');

  const [eventType] = useState('NORMAL_PRODUCTION');
  const [remarks, setRemarks] = useState('');
  const [fromTime] = useState('');
  const [toTime] = useState('');

  // Line Control modal and form states
  const [showLineControl, setShowLineControl] = useState(false);
  const [lineControlTab, setLineControlTab] = useState<'START' | 'STOP' | 'CHANGEOVER'>('START');

  // Start batch sub-form states
  const [startShift, setStartShift] = useState('');
  const [startBrand, setStartBrand] = useState('');
  const [startProduct, setStartProduct] = useState('');
  const [startBatchCode, setStartBatchCode] = useState('');
  const [startRemarks, setStartRemarks] = useState('');
  const [startStartTime, setStartStartTime] = useState(new Date().toISOString().slice(0, 16));

  // End batch sub-form states
  const [endRemarks, setEndRemarks] = useState('');
  const [endEndTime, setEndEndTime] = useState(new Date().toISOString().slice(0, 16));

  // Changeover sub-form states
  const [changeoverBrand, setChangeoverBrand] = useState('');
  const [changeoverProduct, setChangeoverProduct] = useState('');
  const [changeoverStartTime, setChangeoverStartTime] = useState(new Date().toISOString().slice(0, 16));

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
    onSuccess: (response: any, newStation) => {
      setShowStationModal(false);
      const sessionData = response.data || response;
      if (sessionData && sessionData.id) {
        const authStore = useAuthStore.getState();
        if (authStore.user) {
          authStore.setAuth(authStore.token || '', {
            ...authStore.user,
            sessionId: sessionData.id
          });
        }
        if (activeOperator) {
          setActiveOperator((prev: any) => prev ? { ...prev, sessionId: sessionData.id } : null);
        }
      }
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

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.BRANDS)).data
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.PRODUCTS)).data
  });

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.SHIFTS)).data
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => (await api.get(ENDPOINTS.MASTER_DATA.RAW_MATERIALS)).data,
    enabled: currentStationId === 'BLOWING' || currentStationId === 'FILLING',
  });

  const preformRawMaterials = (rawMaterials || []).filter((material: any) => {
    const categoryName = String(material.categoryName || '').toLowerCase();
    const materialName = String(material.name || '').toLowerCase();
    return categoryName.includes('preform') || materialName.includes('preform');
  });
  const capRawMaterials = (rawMaterials || []).filter((material: any) => {
    const categoryName = String(material.categoryName || '').toLowerCase();
    const materialName = String(material.name || '').toLowerCase();
    return categoryName.includes('cap') || materialName.includes('cap');
  });

  // Fetch operators list for the handover selector
  const { data: operatorsList } = useQuery({
    queryKey: ['operators-list'],
    queryFn: async () => (await api.get(ENDPOINTS.TERMINALS.OPERATORS)).data,
  });

  // Line Control Mutations
  const startBatchMutation = useMutation({
    mutationFn: (payload: {
      shiftId: string;
      brandId: string;
      productId: string;
      batchCode?: string;
      remarks?: string;
      startTime: string;
    }) => api.post(ENDPOINTS.PRODUCTION.START_BATCH, {
      lineId: lineId!,
      ...payload
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-batch', lineId] });
      toast.success('Production batch started successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to start production batch');
    }
  });

  const stopBatchMutation = useMutation({
    mutationFn: (payload: { remarks?: string; endTime?: string }) => {
      if (!activeBatch?.batch?.id) {
        throw new Error('No active batch found to close');
      }
      return api.patch(ENDPOINTS.PRODUCTION.CLOSE_BATCH(activeBatch.batch.id), {
        remarks: payload.remarks,
        endTime: payload.endTime ? new Date(payload.endTime).toISOString() : undefined,
        materialReturn: undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-batch', lineId] });
      queryClient.invalidateQueries({ queryKey: ['station-log-history'] });
      toast.success('Production batch closed successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to close production batch');
    }
  });

  const initiateChangeoverMutation = useMutation({
    mutationFn: (payload: { productId: string; startTime: string; reason?: string; notes?: string }) => {
      if (!activeBatch?.batch?.id) {
        throw new Error('No active batch found for changeover');
      }
      return api.post(ENDPOINTS.PRODUCTION.LINE_CHANGEOVER(lineId!), {
        productId: payload.productId,
        batchId: activeBatch.batch.id,
        startTime: new Date(payload.startTime).toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-batch', lineId] });
      toast.success('Changeover initiated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to initiate changeover');
    }
  });

  const completeChangeoverMutation = useMutation({
    mutationFn: () => {
      if (!activeBatch?.batch?.id) {
        throw new Error('No active batch found to complete changeover');
      }
      return api.post(ENDPOINTS.PRODUCTION.COMPLETE_CHANGEOVER(activeBatch.batch.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-batch', lineId] });
      toast.success('Changeover completed. Line is now RUNNING.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to complete changeover');
    }
  });

  // Fetch recent handover details
  const { data: recentHandover, refetch: refetchRecentHandover } = useQuery({
    queryKey: ['recent-handover', lineId, currentStation.id],
    queryFn: async () => {
      if (!lineId || !currentStation.id) return null;
      try {
        const response = await api.get(`/operator-sessions/handover/recent/${lineId}/${currentStation.id}`);
        return response.data;
      } catch (err) {
        return null;
      }
    },
    enabled: !!lineId && !!currentStation.id,
    refetchInterval: 15000,
  });

  const handleHandoverSubmit = async () => {
    if (!incomingOperatorId) {
      toast.error('Please select the incoming operator.');
      return;
    }
    if (!incomingOperatorPin || incomingOperatorPin.length !== 4) {
      toast.error('Please enter a 4-digit PIN for verification.');
      return;
    }
    if (incomingOperatorId === activeOperator?.id) {
      toast.error('Outgoing and incoming operators must be different.');
      return;
    }
    if (!materialStateConfirmed) {
      toast.error('Please confirm you verified material stock assignments.');
      return;
    }
    if (!machineStatusAcknowledged) {
      toast.error('Please confirm you acknowledged the machine status.');
      return;
    }

    try {
      setIsSubmittingHandover(true);
      const response = await api.post('/operator-sessions/handover', {
        incomingOperatorId,
        incomingOperatorPin,
        notes: handoverNotes,
        pendingIssues: handoverIssues,
        materialStateConfirmed,
        machineStatusAcknowledged
      });

      const { access_token, user: newUser } = response.data;

      // Update authentication store
      useAuthStore.getState().setAuth(access_token, newUser);

      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ['active-batch'] });
      queryClient.invalidateQueries({ queryKey: ['recent-handover'] });
      refetchRecentHandover();

      // Reset form states
      setIncomingOperatorId('');
      setIncomingOperatorPin('');
      setHandoverNotes('');
      setHandoverIssues('');
      setMaterialStateConfirmed(false);
      setMachineStatusAcknowledged(false);

      // Update operator state in active UI and close modal
      setActiveOperator(newUser);
      setShowHandoverModal(false);
      toast.success(`Shift handover successful! Now logged in as ${newUser.name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failure or handover rejected.');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const historyQueryKey = ['station-log-history', activeBatch?.batch?.id, currentStation.id] as const;

  const { data: history, refetch: refetchHistory, isFetching: isFetchingHistory } = useQuery({
    queryKey: historyQueryKey,
    queryFn: async () => {
      if (!activeBatch?.batch?.id) return [];
      return (await api.get(`${ENDPOINTS.TELEMETRY.HISTORY(activeBatch.batch.id, currentStation.id)}?operatorView=true`)).data;
    },
    enabled: !!activeBatch?.batch?.id,
    staleTime: 30000,
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
    if (currentStationId === 'FILLING' && productionWastages) {
      const netProd = Math.max(0, rawProductionCount - bottleLeakage);
      setCapUsage(netProd + capWastage);
    } else {
      const total = primaryCount + rejectionCount;
      if (currentStationId === 'BLOWING') setPreformUsage(total);
      if (currentStationId === 'FILLING') setCapUsage(total);
    }
  }, [primaryCount, rejectionCount, rawProductionCount, bottleLeakage, capWastage, productionWastages, currentStationId]);

  // Auto-calculate primaryCount (Production Unit Count) in Packing Station based on casesProduced and selected bottle config multiplier
  useEffect(() => {
    if (currentStation.id === 'PACKING') {
      const activeConfig = bottleConfigs.find(c => c.id === selectedBottleConfig);
      const multiplier = activeConfig ? activeConfig.multiplier : 0;
      setPrimaryCount(casesProduced * multiplier);
    }
  }, [casesProduced, selectedBottleConfig, currentStation.id]);

  const handleSaveTelemetry = async (type: 'ALL' | 'COUNT' | 'EVENT' | 'WASTE' = 'ALL') => {
    if (!activeBatch?.batch) return toast.error('No active batch found.');
    if (isSubmitting) return;

    const isCountEmpty = (currentStation.id === 'FILLING' && productionWastages)
      ? rawProductionCount === 0
      : primaryCount === 0;

    if (type === 'COUNT' && isCountEmpty && currentStation.id !== 'QC') {
      return toast.error(currentStation.id === 'FILLING' && productionWastages ? 'Enter raw production count' : 'Enter production count');
    }
    if (currentStation.id === 'FILLING' && productionWastages && bottleLeakage > rawProductionCount) {
      return toast.error('Filled bottle leakage cannot exceed raw production count');
    }
    if (currentStation.id === 'FILLING' && !selectedCapRawMaterialId) return toast.error('Please select the Caps raw material.');
    if (currentStation.id === 'BLOWING' && !selectedRawMaterialId) return toast.error('Please select the Raw Material.');

    const currentBatch = activeBatch?.batch;
    const selectedCapRawMaterial = capRawMaterials.find((material: any) => material.id === selectedCapRawMaterialId);

    const calculatedPrimaryCount = (currentStation.id === 'FILLING' && productionWastages)
      ? Math.max(0, rawProductionCount - bottleLeakage)
      : Math.floor(primaryCount);

    const calculatedWastageCount = (currentStation.id === 'FILLING' && productionWastages)
      ? (bottleLeakage + capWastage)
      : (currentStation.id === 'PACKING'
        ? (parseFloat(shrinkWasteWeight) || 0)
        : rejectionCount);

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
      primaryCount: calculatedPrimaryCount,
      wastageCount: calculatedWastageCount,
      secondaryPackagingCount: Math.floor(secondaryPackagingCount),
      eventType: type === 'EVENT' ? eventType : 'NORMAL_PRODUCTION',
      isRework: false,
      remarks: type === 'EVENT' ? remarks : '',
      fromTime: type === 'EVENT' ? fromTime : undefined,
      toTime: type === 'EVENT' ? toTime : undefined,
      loggedAt: new Date().toISOString()
    };

    if (currentStation.id === 'FILLING') {
      logEntry.bottleLeakage = productionWastages ? bottleLeakage : 0;
      logEntry.capWastage = productionWastages ? capWastage : 0;
    }

    if (currentStation.id === 'BLOWING') {
      // For Blowing, we purchase in KGs but produce in COUNT.
      // We track 'preformsUsed' as the count of preforms consumed.
      logEntry.preformUsage = preformUsage || (primaryCount + rejectionCount);
      logEntry.rawMaterialId = selectedRawMaterialId;
      logEntry.bagsUsed = bagsUsed;
    } else if (currentStation.id === 'FILLING') {
      logEntry.capUsage = capUsage || (calculatedPrimaryCount + (productionWastages ? capWastage : calculatedWastageCount));
      logEntry.capBoxUsage = capBoxUsage;
      logEntry.rawMaterialId = selectedCapRawMaterialId;
      logEntry.materials = selectedCapRawMaterial ? [{
        materialName: selectedCapRawMaterial.name,
        quantity: logEntry.capUsage,
        unit: 'Pcs',
        waste: (productionWastages ? capWastage : rejectionCount),
      }] : [];
    } else if (currentStation.id === 'LABELING') {
      logEntry.bopRollUsage = labelUsage;
      logEntry.labelStickerWeight = labelUsage;
      logEntry.damagedLabelWeight = rejectionCount;
      logEntry.inkChanged = inkChanged;
      logEntry.inkUsageMl = 0;
      logEntry.makeupChanged = makeupChanged;
      logEntry.makeupUsageMl = 0;
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
      const response = await api.post(ENDPOINTS.TELEMETRY.LOGS, logEntry);
      const committedLog = response.data?.log;
      const rawMaterialName = currentStation.id === 'BLOWING'
        ? rawMaterials?.find((material: any) => material.id === selectedRawMaterialId)?.name
        : selectedCapRawMaterial?.name;

      queryClient.setQueryData<any[]>(historyQueryKey, (previous = []) => {
        const newHistoryEntry = {
          id: `prod_log_${committedLog?.id || logEntry.requestId}`,
          primaryCount: committedLog?.primaryCount ?? logEntry.primaryCount,
          wastageCount: committedLog?.wastageCount ?? logEntry.wastageCount,
          bottleLeakage: committedLog?.bottleLeakage ?? logEntry.bottleLeakage,
          capWastage: committedLog?.capWastage ?? logEntry.capWastage,
          eventType: committedLog?.eventType ?? logEntry.eventType,
          secondaryPackagingCount: committedLog?.secondaryPackagingCount ?? logEntry.secondaryPackagingCount,
          remarks: committedLog?.remarks ?? logEntry.remarks,
          loggedAt: committedLog?.loggedAt ?? logEntry.loggedAt,
          userName: activeOperator?.name || user?.name || 'Operator',
          source: ['MACHINE_BREAKDOWN', 'POWER_FAILURE', 'LOW_SPEED'].includes(logEntry.eventType) ? 'MACHINE' : 'OPERATOR',
          station: committedLog?.station ?? logEntry.station,
          rawMaterialId: committedLog?.rawMaterialId ?? logEntry.rawMaterialId,
          rawMaterialName,
          bagsUsed: committedLog?.bagsUsed ?? logEntry.bagsUsed,
          preformUsage: committedLog?.preformUsage ?? logEntry.preformUsage,
          capUsage: committedLog?.capUsage ?? logEntry.capUsage,
          capBoxUsage: committedLog?.capBoxUsage ?? logEntry.capBoxUsage,
          bopRollUsage: committedLog?.bopRollUsage ?? logEntry.bopRollUsage,
          shrinkWasteWeight: committedLog?.shrinkWasteWeight ?? logEntry.shrinkWasteWeight,
          sourceBatchNumber: committedLog?.sourceBatchNumber ?? logEntry.sourceBatchNumber,
        };

        const withoutDuplicate = previous.filter((entry: any) => entry.id !== newHistoryEntry.id);
        return [newHistoryEntry, ...withoutDuplicate].slice(0, 50);
      });

      toast.success('Log Successfully Transmitted');
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ['active-batch'] });

      setPrimaryCount(0); setRejectionCount(0); setSecondaryPackagingCount(0);
      setPreformUsage(0); setCapUsage(0); setCapBoxUsage(0); setSelectedCapRawMaterialId(''); setSelectedRawMaterialId(''); setBagsUsed(0); setLabelUsage(0); setShrinkUsage('');
      setCasesProduced(0); setPhValue(0); setTdsValue(0);
      setInkChanged(false);
      setMakeupChanged(false);
      setShrinkWasteWeight('');
      setSelectedBottleConfig('');
      setRawProductionCount(0);
      setBottleLeakage(0);
      setCapWastage(0);
      setProductionWastages(false);
    } catch (err: any) {
      toast.error('Failed to transmit log. Node error.');
    } finally { setIsSubmitting(false); }
  };

  if (!activeOperator) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-12 h-12 text-[#1A9A91] animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Initializing OS...</p>
      </div>
    );
  }

  const machineStatus = (activeEvents?.length > 0) ? 'ERROR' : (activeBatch?.batch?.status === 'RUNNING' ? 'RUNNING' : 'IDLE');

  return (
    <div className="operator-page h-screen bg-white flex flex-col overflow-hidden">
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-all duration-500 animate-in fade-in">
          <Loader2 className="w-16 h-16 text-[#1A9A91] animate-spin mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-2">Terminating Session</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Securing workspace and syncing ledger...</p>
        </div>
      )}

      <OperatorHeader
        lineName={line?.name || 'Line'}
        stationName={currentStation.title}
        operatorName={activeOperator?.name || 'Operator'}
        batchCode={activeBatch?.batch?.batchCode}
        productName={activeBatch?.batch?.productName || activeBatch?.productName}
        machineStatus={machineStatus}
        isLoggingOut={isLoggingOut}
        onChangeStation={() => setShowStationModal(true)}
        onLogout={() => endSessionMutation.mutate()}
        onDowntime={() => toast.info('Downtime Modal: Coming Soon')}
        onHandover={() => setShowHandoverModal(true)}
        recentHandover={recentHandover}
      />

      <StationWorkspace
        title={currentStation.title}
        description="Production Data Processing Node"
        headerActions={
          <div className="flex gap-2">
            <button
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="lg:hidden px-5 py-3 bg-[#1A9A91] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#157C75] active:scale-95 transition-all shadow-lg shadow-[#1A9A91]/15 flex items-center gap-2 cursor-pointer animate-in fade-in"
            >
              <History size={14} />
              {currentStation.id === 'BLOWING' ? 'Blowing History' : `${currentStation.title.replace(' Station', '')} History`}
            </button>
            <button
              onClick={() => {
                if (!activeBatch?.batch) {
                  setLineControlTab('START');
                } else if (activeBatch?.batch?.status === 'CHANGEOVER') {
                  setLineControlTab('CHANGEOVER');
                } else {
                  setLineControlTab('STOP');
                }
                setShowLineControl(true);
              }}
              className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-950/15 flex items-center gap-2 cursor-pointer animate-in fade-in"
            >
              Line Control
            </button>
          </div>
        }
        sidebar={
          <ActivityFeed 
            history={history || []} 
            onRefresh={() => {
              refetchHistory();
              queryClient.invalidateQueries({ queryKey: ['station-log-history'] });
              queryClient.invalidateQueries({ queryKey: ['active-batch'] });
              toast.success('Uplink Feed Refreshed');
            }} 
            isRefreshing={isFetchingHistory} 
          />
        }
      >
        {!activeBatch?.batch ? (
          <div className="bg-white border border-[#1A9A91]/15 rounded-[2rem] p-8 md:p-12 shadow-sm shadow-[#1A9A91]/5 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
            <div className="w-20 h-20 bg-[#1A9A91]/10 rounded-[2rem] flex items-center justify-center border border-[#1A9A91]/25 animate-pulse">
              <Zap className="w-10 h-10 text-[#1A9A91]" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Line Standby Mode</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-md mx-auto leading-relaxed">
                There is no active production batch running on {line?.name || 'this line'}. Please start a batch to enable telemetry logging.
              </p>
            </div>
            <button
              onClick={() => {
                setLineControlTab('START');
                setShowLineControl(true);
              }}
              className="px-8 py-4 bg-[#1A9A91] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-[#157C75] active:scale-95 transition-all shadow-xl shadow-[#1A9A91]/20 flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Production Batch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Main Action Card */}
            <div className="bg-white border border-[#1A9A91]/15 rounded-[2rem] p-5 md:p-6 shadow-sm shadow-[#1A9A91]/5 space-y-6">
            {currentStation.id === 'FILLING' && (
              <div className="space-y-4">
                {/* Production Wastages Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#1A9A91]/5 border border-[#1A9A91]/15 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Production Wastages</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Track bottle leaks and damaged caps</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProductionWastages(!productionWastages)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      productionWastages ? "bg-[#1A9A91]" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        productionWastages ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {currentStation.id === 'FILLING' && productionWastages ? (
                <>
                  <IndustrialNumericInput
                    label="Raw Production Count"
                    value={rawProductionCount}
                    onChange={setRawProductionCount}
                    suffix="Units"
                    compact
                  />
                  <IndustrialNumericInput
                    label="Filled Bottle Leak / Yield Waste"
                    value={bottleLeakage}
                    onChange={setBottleLeakage}
                    suffix="Units"
                    compact
                  />
                  <IndustrialNumericInput
                    label="Cap Damaged Count"
                    value={capWastage}
                    onChange={setCapWastage}
                    suffix="Units"
                    compact
                  />
                  <div className="md:col-span-2 p-4 bg-[#1A9A91]/5 border border-[#1A9A91]/15 rounded-2xl flex justify-between text-xs font-black uppercase tracking-wider text-slate-500">
                    <div>
                      Net Production: <span className="text-[#1A9A91] font-bold">{Math.max(0, rawProductionCount - bottleLeakage)} Units</span>
                    </div>
                    <div>
                      Total Wastage: <span className="text-rose-500 font-bold">{bottleLeakage + capWastage} Units</span>
                    </div>
                  </div>
                </>
              ) : currentStation.id === 'LABELING' ? (
                <>
                  <IndustrialNumericInput
                    label="Production Unit Count"
                    value={primaryCount}
                    onChange={setPrimaryCount}
                    suffix="Units"
                    compact
                  />
                  <IndustrialNumericInput
                    label="Label Wastage"
                    value={rejectionCount}
                    onChange={setRejectionCount}
                    suffix="KG"
                    step={0.01}
                    compact
                  />
                </>
              ) : currentStation.id === 'PACKING' ? (
                null
              ) : (
                <>
                  <IndustrialNumericInput
                    label="Production Unit Count"
                    value={primaryCount}
                    onChange={setPrimaryCount}
                    suffix="Units"
                    compact
                  />

                  <IndustrialNumericInput
                    label="Rejects / Waste"
                    value={rejectionCount}
                    onChange={setRejectionCount}
                    suffix="Units"
                    compact
                  />
                </>
              )}

              <div className="contents">
                
                {currentStation.id === 'BLOWING' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block">
                        Raw Material
                      </label>
                      <select
                        value={selectedRawMaterialId}
                        onChange={e => setSelectedRawMaterialId(e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-[#1A9A91]/45 transition-all"
                      >
                        <option value="">Select Raw Material...</option>
                        {preformRawMaterials.map((material: any) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.categoryName})
                          </option>
                        ))}
                      </select>
                      {preformRawMaterials.length === 0 && (
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-2">
                          No preform raw materials found.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <IndustrialNumericInput
                        label="Bags Used"
                        value={bagsUsed}
                        onChange={setBagsUsed}
                        suffix="Bags"
                        compact
                      />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                        (1 bag = 25KG)
                      </p>
                    </div>

                    <div className="space-y-1">
                      <IndustrialNumericInput
                        label="Preforms Used (This Log)"
                        value={preformUsage}
                        onChange={() => {}} 
                        suffix="Pcs"
                        readOnly
                        compact
                      />
                      <p className="text-[10px] font-black text-[#1A9A91] uppercase tracking-widest px-2">
                        Batch Total: <span className="text-slate-900">{(activeBatch as any)?.materialTotals?.preformTotal || 0} PCS</span>
                      </p>
                    </div>
                  </>
                )}
                
                {currentStation.id === 'FILLING' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block">
                        Caps Raw Material
                      </label>
                      <select
                        value={selectedCapRawMaterialId}
                        onChange={e => setSelectedCapRawMaterialId(e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-[#1A9A91]/45 transition-all"
                      >
                        <option value="">Select Caps raw material...</option>
                        {capRawMaterials.map((material: any) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.categoryName})
                          </option>
                        ))}
                      </select>
                      {capRawMaterials.length === 0 && (
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-2">
                          No caps raw materials found.
                        </p>
                      )}
                    </div>

                    <IndustrialNumericInput
                      label="Cap Box Usage"
                      value={capBoxUsage}
                      onChange={setCapBoxUsage}
                      suffix="Boxes"
                      compact
                    />

                    <div className="space-y-1">
                      <IndustrialNumericInput
                        label="Caps Used (This Log)"
                        value={capUsage}
                        onChange={() => {}}
                        suffix="Pcs"
                        readOnly
                        compact
                      />
                      <p className="text-[10px] font-black text-[#1A9A91] uppercase tracking-widest px-2">
                        Batch Total: <span className="text-slate-900">
                          {((activeBatch as any)?.materialTotals?.capTotal || 0)} PCS
                        </span>
                      </p>
                    </div>
                  </>
                )}
                
                {currentStation.id === 'LABELING' && (
                  <>
                    <div className="space-y-1">
                      <IndustrialNumericInput
                        label="Label Used"
                        value={labelUsage}
                        onChange={setLabelUsage}
                        suffix="KG"
                        step={0.01}
                        compact
                      />
                    </div>
                    
                    <div className="p-4 border border-[#1A9A91]/15 rounded-xl bg-[#1A9A91]/5 space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={inkChanged} onChange={e => setInkChanged(e.target.checked)} className="w-5 h-5 rounded text-[#1A9A91] focus:ring-[#1A9A91]" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">Ink Used</span>
                      </label>
                      
                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input type="checkbox" checked={makeupChanged} onChange={e => setMakeupChanged(e.target.checked)} className="w-5 h-5 rounded text-[#1A9A91] focus:ring-[#1A9A91]" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700">Makeup Used</span>
                      </label>
                    </div>
                  </>
                )}
                
                {currentStation.id === 'PACKING' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Row 1 */}
                    <div className="p-4 border border-[#1A9A91]/15 rounded-xl bg-[#1A9A91]/5 flex flex-col justify-center">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-2">Production Source Batch</label>
                      <input type="text" value={activeBatch?.batch?.batchCode || 'N/A'} readOnly className="w-full bg-slate-200 border-none rounded-lg px-4 py-3 text-slate-500 font-bold font-mono outline-none cursor-not-allowed" />
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 leading-tight select-none mb-2">
                        Bottle Configuration
                      </label>
                      <select
                        value={selectedBottleConfig}
                        onChange={e => setSelectedBottleConfig(e.target.value)}
                        className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-[#1A9A91]/45 transition-all shadow-sm"
                      >
                        <option value="">Select Configuration...</option>
                        {bottleConfigs.map(config => (
                          <option key={config.id} value={config.id}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Row 2 */}
                    <IndustrialNumericInput 
                      label="Cases Produced" 
                      value={casesProduced} 
                      onChange={setCasesProduced} 
                      suffix="Cases" 
                      compact 
                    />

                    <div className="opacity-75">
                      <IndustrialNumericInput 
                        label="Production Unit Count" 
                        value={primaryCount} 
                        onChange={() => {}} 
                        suffix="Bottles" 
                        readOnly 
                        compact 
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 leading-tight select-none">
                        Shrink Material Used (g)
                      </label>
                      <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#1A9A91]/20 focus-within:border-[#1A9A91]/35 h-14">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={shrinkUsage}
                          onChange={e => setShrinkUsage(e.target.value)}
                          placeholder="e.g. 1.256"
                          className="flex-1 min-w-0 bg-transparent text-center font-mono font-black text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-2 text-xl"
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none select-none pr-3">g</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 leading-tight select-none">
                        Shrink Material Waste (g)
                      </label>
                      <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#1A9A91]/20 focus-within:border-[#1A9A91]/35 h-14">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={shrinkWasteWeight}
                          onChange={e => setShrinkWasteWeight(e.target.value)}
                          placeholder="e.g. 0.124"
                          className="flex-1 min-w-0 bg-transparent text-center font-mono font-black text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-2 text-xl"
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none select-none pr-3">g</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#1A9A91]/5 border border-[#1A9A91]/15 rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="text-[#1A9A91]" size={18} />
                <h4 className="text-xs font-black text-[#1A9A91] uppercase tracking-widest">Anomaly Signature</h4>
              </div>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Describe machine event or stop reason..."
                className="w-full h-20 bg-white border border-[#1A9A91]/20 rounded-xl p-4 text-xs font-bold text-slate-700 placeholder:text-[#1A9A91]/35 outline-none focus:border-[#1A9A91]/50 transition-all resize-none"
              />
            </div>

            <button
              onClick={() => handleSaveTelemetry('ALL')}
              disabled={isSubmitting}
              className="w-full h-16 bg-[#1A9A91] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-4 shadow-xl shadow-[#1A9A91]/15 hover:bg-[#157C75] transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Layers size={20} />}
              Commit to Ledger
            </button>
          </div>
        </div>
        )}
      </StationWorkspace>

      <AnimatePresence>
        {isHistoryDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="fixed inset-0 bg-black z-50 lg:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-white z-50 lg:hidden shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="p-6 border-b border-[#1A9A91]/15 flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                    {currentStation.id === 'BLOWING' ? 'Blowing History' : `${currentStation.title.replace(' Station', '')} History`}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Real-time Telemetry Stream</p>
                </div>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-800 transition-colors shadow-sm cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ActivityFeed 
                  history={history || []} 
                  onRefresh={() => {
                    refetchHistory();
                    queryClient.invalidateQueries({ queryKey: ['station-log-history'] });
                    queryClient.invalidateQueries({ queryKey: ['active-batch'] });
                    toast.success('Uplink Feed Refreshed');
                  }} 
                  isRefreshing={isFetchingHistory} 
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Dialog open={showStationModal} onOpenChange={setShowStationModal}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader className="space-y-4 mb-6">
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Change <span className="text-[#1A9A91]">Station</span>
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
                      : 'bg-white border-slate-200 hover:border-[#1A9A91]/35 hover:shadow-md cursor-pointer'
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
                  {isSwitching && <Loader2 className="w-5 h-5 text-[#1A9A91] animate-spin" />}
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

      <Dialog open={showHandoverModal} onOpenChange={setShowHandoverModal}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-[2rem] border-none shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-4 mb-6">
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Shift <span className="text-[#1A9A91]">Handover</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Transfer custody of the active production station. Counts, batch state, and telemetry will remain uninterrupted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Outgoing Operator Notes */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Handover Notes</label>
              <textarea
                value={handoverNotes}
                onChange={e => setHandoverNotes(e.target.value)}
                placeholder="Describe current station run observations, parameters, heater zones..."
                className="w-full h-24 bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Pending Issues / Maintenance remarks</label>
              <input
                type="text"
                value={handoverIssues}
                onChange={e => setHandoverIssues(e.target.value)}
                placeholder="List any mechanical faults or raw material delays..."
                className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all"
              />
            </div>

            <hr className="border-slate-100" />

            {/* Incoming Operator Identification */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Incoming Operator Auth</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Operator</label>
                  <select
                    value={incomingOperatorId}
                    onChange={e => setIncomingOperatorId(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all"
                  >
                    <option value="">Choose Operator...</option>
                    {operatorsList?.filter((op: any) => op.id !== activeOperator?.id).map((op: any) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Enter Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={incomingOperatorPin}
                    onChange={e => setIncomingOperatorPin(e.target.value)}
                    placeholder="****"
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-center text-lg font-black text-slate-900 outline-none tracking-widest focus:border-[#1A9A91] transition-all"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Checkbox Acknowledgment */}
            <div className="p-4 bg-[#1A9A91]/5 border border-[#1A9A91]/15 rounded-2xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={materialStateConfirmed}
                  onChange={e => setMaterialStateConfirmed(e.target.checked)}
                  className="w-5 h-5 rounded text-[#1A9A91] mt-0.5 border-slate-300 focus:ring-[#1A9A91]"
                />
                <span className="text-[11px] font-bold text-slate-700 leading-normal">
                  I confirm that physical raw material counts (preforms/caps/shrink rolls) align with the counts recorded in the terminal.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={machineStatusAcknowledged}
                  onChange={e => setMachineStatusAcknowledged(e.target.checked)}
                  className="w-5 h-5 rounded text-[#1A9A91] mt-0.5 border-slate-300 focus:ring-[#1A9A91]"
                />
                <span className="text-[11px] font-bold text-slate-700 leading-normal">
                  I acknowledge the current machine running state and verified that all safety shields are active.
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowHandoverModal(false)}
              className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmittingHandover}
              onClick={handleHandoverSubmit}
              className="h-12 bg-[#1A9A91] hover:bg-[#157C75] text-white font-black uppercase tracking-widest rounded-xl transition-all px-6"
            >
              {isSubmittingHandover ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Handover'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Line Control Dialog */}
      <Dialog open={showLineControl} onOpenChange={setShowLineControl}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-[2rem] border-none shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-4 mb-6">
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">
              Line <span className="text-[#1A9A91]">Control</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Manage the active production run and changeovers for {line?.name || 'this line'}.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Selector (only visible if batch exists and status is not CHANGEOVER) */}
          {activeBatch?.batch && activeBatch?.batch?.status !== 'CHANGEOVER' && (
            <div className="flex border-b border-slate-200 mb-6">
              <button
                onClick={() => setLineControlTab('STOP')}
                className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  lineControlTab === 'STOP' ? 'border-[#1A9A91] text-[#1A9A91]' : 'border-transparent text-slate-400'
                }`}
              >
                End Production
              </button>
              <button
                onClick={() => setLineControlTab('CHANGEOVER')}
                className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  lineControlTab === 'CHANGEOVER' ? 'border-[#1A9A91] text-[#1A9A91]' : 'border-transparent text-slate-400'
                }`}
              >
                SKU Changeover
              </button>
            </div>
          )}

          {/* 1. START BATCH VIEW */}
          {(!activeBatch?.batch || lineControlTab === 'START') && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-[#1A9A91]/5 border border-[#1A9A91]/15 rounded-2xl">
                <p className="text-[10px] font-black text-[#1A9A91] uppercase tracking-widest mb-1">Start New Batch</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Enter the details to initialize the line.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Active Shift</label>
                <select
                  value={startShift}
                  onChange={e => setStartShift(e.target.value)}
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all"
                >
                  <option value="">-- Select Shift --</option>
                  {shifts?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Brand</label>
                  <select
                    value={startBrand}
                    onChange={e => { setStartBrand(e.target.value); setStartProduct(''); }}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all"
                  >
                    <option value="">-- Select Brand --</option>
                    {brands?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Product SKU</label>
                  <select
                    value={startProduct}
                    onChange={e => setStartProduct(e.target.value)}
                    disabled={!startBrand}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all disabled:opacity-40"
                  >
                    <option value="">-- Select Product --</option>
                    {products?.filter((p: any) => p.brandId === startBrand).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Batch Code (Optional)</label>
                  <input
                    type="text"
                    value={startBatchCode}
                    onChange={e => setStartBatchCode(e.target.value)}
                    placeholder="e.g. EB26001 (Blank for Auto)"
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={startStartTime}
                    onChange={e => setStartStartTime(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Start Remarks</label>
                <textarea
                  value={startRemarks}
                  onChange={e => setStartRemarks(e.target.value)}
                  placeholder="Notes about product lines, starting pre-checks, etc..."
                  className="w-full h-20 bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-[#1A9A91] transition-all resize-none"
                />
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLineControl(false)}
                  className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </Button>
                <Button
                  disabled={startBatchMutation.isPending || !startShift || !startBrand || !startProduct}
                  onClick={() => {
                    startBatchMutation.mutate({
                      shiftId: startShift,
                      brandId: startBrand,
                      productId: startProduct,
                      batchCode: startBatchCode || undefined,
                      remarks: startRemarks || undefined,
                      startTime: new Date(startStartTime).toISOString()
                    }, {
                      onSuccess: () => {
                        setShowLineControl(false);
                        setStartShift('');
                        setStartBrand('');
                        setStartProduct('');
                        setStartBatchCode('');
                        setStartRemarks('');
                      }
                    });
                  }}
                  className="h-12 bg-[#1A9A91] hover:bg-[#157C75] text-white font-black uppercase tracking-widest rounded-xl transition-all px-6 disabled:opacity-50"
                >
                  {startBatchMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Launch Batch'}
                </Button>
              </div>
            </div>
          )}

          {/* 2. STOP BATCH VIEW */}
          {activeBatch?.batch && activeBatch?.batch?.status !== 'CHANGEOVER' && lineControlTab === 'STOP' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">Finalize Production</p>
                <p className="text-xs font-bold uppercase tracking-wide">Closing batch will trigger inventory deduction and lock logging.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endEndTime}
                  onChange={e => setEndEndTime(e.target.value)}
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Ending Remarks / Audit Reason</label>
                <textarea
                  value={endRemarks}
                  onChange={e => setEndRemarks(e.target.value)}
                  placeholder="Describe final counts confirmation, reasons for end..."
                  className="w-full h-24 bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 transition-all resize-none"
                />
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLineControl(false)}
                  className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </Button>
                <Button
                  disabled={stopBatchMutation.isPending || !endRemarks}
                  onClick={() => {
                    stopBatchMutation.mutate({
                      remarks: endRemarks,
                      endTime: new Date(endEndTime).toISOString()
                    }, {
                      onSuccess: () => {
                        setShowLineControl(false);
                        setEndRemarks('');
                      }
                    });
                  }}
                  className="h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest rounded-xl transition-all px-6 disabled:opacity-50"
                >
                  {stopBatchMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Stop'}
                </Button>
              </div>
            </div>
          )}

          {/* 3. SKU CHANGEOVER VIEW */}
          {activeBatch?.batch && activeBatch?.batch?.status !== 'CHANGEOVER' && lineControlTab === 'CHANGEOVER' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">Initiate SKU Changeover</p>
                <p className="text-xs font-bold uppercase tracking-wide">This will transition the line to CHANGEOVER status for product swap.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Next Brand</label>
                  <select
                    value={changeoverBrand}
                    onChange={e => { setChangeoverBrand(e.target.value); setChangeoverProduct(''); }}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-amber-400 transition-all"
                  >
                    <option value="">-- Select Brand --</option>
                    {brands?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Next Product SKU</label>
                  <select
                    value={changeoverProduct}
                    onChange={e => setChangeoverProduct(e.target.value)}
                    disabled={!changeoverBrand}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-amber-400 transition-all disabled:opacity-40"
                  >
                    <option value="">-- Select Product --</option>
                    {products?.filter((p: any) => p.brandId === changeoverBrand).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Changeover Start Time</label>
                <input
                  type="datetime-local"
                  value={changeoverStartTime}
                  onChange={e => setChangeoverStartTime(e.target.value)}
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLineControl(false)}
                  className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </Button>
                <Button
                  disabled={initiateChangeoverMutation.isPending || !changeoverProduct}
                  onClick={() => {
                    initiateChangeoverMutation.mutate({
                      productId: changeoverProduct,
                      startTime: new Date(changeoverStartTime).toISOString()
                    }, {
                      onSuccess: () => {
                        setShowLineControl(false);
                        setChangeoverBrand('');
                        setChangeoverProduct('');
                      }
                    });
                  }}
                  className="h-12 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest rounded-xl transition-all px-6 disabled:opacity-50"
                >
                  {initiateChangeoverMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Changeover'}
                </Button>
              </div>
            </div>
          )}

          {/* 4. CHANGEOVER ACTIVE VIEW */}
          {activeBatch?.batch && activeBatch?.batch?.status === 'CHANGEOVER' && (
            <div className="space-y-5 text-center py-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 border border-amber-100 rounded-full flex items-center justify-center mx-auto animate-spin mb-4">
                <RefreshCcw className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black uppercase text-slate-800">Changeover in Progress</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Target Product: {activeBatch?.productName || activeBatch?.batch?.productName || 'New SKU'}
                </p>
                <p className="text-[11px] text-slate-500 mt-4 leading-relaxed max-w-md mx-auto">
                  Click below once the physical lines mechanical adjustments (heater zones, labeling rails, filling guides) are completed and the new SKU run is ready to start.
                </p>
              </div>

              <div className="pt-6 flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowLineControl(false)}
                  className="h-12 border-slate-200 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Close Window
                </Button>
                <Button
                  disabled={completeChangeoverMutation.isPending}
                  onClick={() => {
                    completeChangeoverMutation.mutate(undefined, {
                      onSuccess: () => {
                        setShowLineControl(false);
                      }
                    });
                  }}
                  className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl transition-all px-6"
                >
                  {completeChangeoverMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Changeover & Start'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
