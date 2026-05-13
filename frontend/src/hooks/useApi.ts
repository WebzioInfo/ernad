/**
 * ERNAD MES – REACT QUERY HOOKS
 * All hooks are built on top of api-services.ts.
 * queryKeys are standardized for safe invalidation.
 * No endpoint strings appear here – only service calls.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import {
  ProductionService,
  TelemetryService,
  OperatorSessionService,
  MasterDataService,
  UserService,
  InventoryService,
  AnalyticsService,
  BiometricService,
  NotesService,
  NotificationService,
  type StartBatchPayload,
  type CloseBatchPayload,
  type TelemetryLogPayload,
  type CreateNotePayload,
} from '../services/api-services';

// ─── QUERY KEY REGISTRY ───────────────────────────────────────────────────────
// Centralized – prevents string typos across components

export const QK = {
  // Production
  BATCHES: ['production-batches'] as const,
  ACTIVE_BATCH: (lineId: string) => ['active-batch', lineId] as const,
  // Telemetry
  LOG_HISTORY: (batchId: string, station: string) => ['log-history', batchId, station] as const,
  ACTIVE_EVENTS: (batchId: string) => ['active-events', batchId] as const,
  RECONCILIATION: (batchId: string) => ['reconciliation', batchId] as const,
  // Sessions
  CURRENT_SESSION: ['current-operator-session'] as const,
  ACTIVE_SESSIONS: ['active-sessions'] as const,
  // Master data
  LINES: ['production-lines'] as const,
  LINE: (id: string) => ['line', id] as const,
  BRANDS: ['brands'] as const,
  PRODUCTS: ['products'] as const,
  SHIFTS: ['shifts'] as const,
  // Users
  USERS: ['users'] as const,
  USER: (id: string) => ['user', id] as const,
  AUDIT_LOGS: ['audit-logs'] as const,
  // Inventory
  STOCK: ['inventory-stock'] as const,
  STOCK_BY_CATEGORY: (cat: string) => ['inventory-stock', cat] as const,
  CATEGORIES: ['inventory-categories'] as const,
  WAREHOUSES: ['inventory-warehouses'] as const,
  TRANSFERS: ['inventory-transfers'] as const,
  PACKING_CONFIGS: (productId: string) => ['packing-configs', productId] as const,
  LEDGER: (stockId: string) => ['ledger', stockId] as const,
  // Analytics
  KPIS: ['kpis'] as const,
  LINE_PERF: (lineId?: string) => ['line-performance', lineId] as const,
  FACTORY_LIVE: ['factory-live'] as const,
  // Biometric
  DEVICES: ['biometric-devices'] as const,
  ATTENDANCE_TODAY: ['attendance-today'] as const,
  ATTENDANCE: (userId: string) => ['attendance', userId] as const,
  MONTHLY_REPORT: (userId: string, month: number, year: number) =>
    ['monthly-report', userId, month, year] as const,
  // Notes
  NOTES: ['notes'] as const,
  NOTE: (id: string) => ['note', id] as const,
  // Notifications
  NOTIFICATIONS: ['notifications-unread'] as const,
};

// ─── PRODUCTION HOOKS ─────────────────────────────────────────────────────────

export function useBatches(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...QK.BATCHES, params],
    queryFn: () => ProductionService.getBatches(params),
  });
}

export function useActiveBatch(lineId: string | undefined) {
  return useQuery({
    queryKey: QK.ACTIVE_BATCH(lineId!),
    queryFn: () => ProductionService.getActiveBatch(lineId!),
    enabled: !!lineId,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useStartBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartBatchPayload) => ProductionService.startBatch(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.LINES }),
  });
}

export function useCloseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: CloseBatchPayload }) =>
      ProductionService.closeBatch(batchId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.LINES }),
  });
}

export function useReopenBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, reason }: { batchId: string; reason: string }) =>
      ProductionService.reopenBatch(batchId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.LINES }),
  });
}

export function useSubmitQualityCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ProductionService.submitQualityCheck,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.BATCHES }),
  });
}

export function useInitiateChangeover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: string; payload: { batchId: string; productId: string } }) =>
      ProductionService.initiateChangeover(lineId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.LINES }),
  });
}

export function useCompleteChangeover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => ProductionService.completeChangeover(batchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.LINES }),
  });
}

// ─── TELEMETRY HOOKS ──────────────────────────────────────────────────────────

export function useLogHistory(batchId: string | undefined, station: string) {
  return useQuery({
    queryKey: QK.LOG_HISTORY(batchId!, station),
    queryFn: () => TelemetryService.getHistory(batchId!, station),
    enabled: !!batchId,
  });
}

export function useActiveEvents(batchId: string | undefined) {
  return useQuery({
    queryKey: QK.ACTIVE_EVENTS(batchId!),
    queryFn: () => TelemetryService.getActiveEvents(batchId!),
    enabled: !!batchId,
    refetchInterval: 30_000,
  });
}

export function useReconciliation(batchId: string | undefined) {
  return useQuery({
    queryKey: QK.RECONCILIATION(batchId!),
    queryFn: () => TelemetryService.getReconciliation(batchId!),
    enabled: !!batchId,
  });
}

/**
 * Primary telemetry mutation.
 * Automatically injects a requestId (idempotency key) if not provided.
 */
export function useLogTelemetry(options?: {
  onSuccess?: () => void;
  batchId?: string;
  station?: string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<TelemetryLogPayload, 'requestId'> & { requestId?: string }) =>
      TelemetryService.log({ ...payload, requestId: payload.requestId ?? uuidv4() }),
    onSuccess: () => {
      if (options?.batchId) {
        qc.invalidateQueries({ queryKey: QK.ACTIVE_BATCH(options.batchId) });
        if (options.station) {
          qc.invalidateQueries({
            queryKey: QK.LOG_HISTORY(options.batchId, options.station),
          });
        }
      }
      options?.onSuccess?.();
    },
  });
}

// ─── OPERATOR SESSION HOOKS ───────────────────────────────────────────────────

export function useCurrentSession() {
  return useQuery({
    queryKey: QK.CURRENT_SESSION,
    queryFn: () => OperatorSessionService.getCurrent(),
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: QK.ACTIVE_SESSIONS,
    queryFn: () => OperatorSessionService.getActive(),
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => OperatorSessionService.end(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.CURRENT_SESSION }),
  });
}

// ─── MASTER DATA HOOKS ────────────────────────────────────────────────────────

export function useLines() {
  return useQuery({
    queryKey: QK.LINES,
    queryFn: () => MasterDataService.getLines(),
    refetchInterval: 15_000,
  });
}

export function useLine(lineId: string | undefined) {
  return useQuery({
    queryKey: QK.LINE(lineId!),
    queryFn: () => MasterDataService.getLine(lineId!),
    enabled: !!lineId,
    retry: 1,
  });
}

export function useBrands() {
  return useQuery({ queryKey: QK.BRANDS, queryFn: () => MasterDataService.getBrands() });
}

export function useProducts() {
  return useQuery({ queryKey: QK.PRODUCTS, queryFn: () => MasterDataService.getProducts() });
}

export function useShifts() {
  return useQuery({ queryKey: QK.SHIFTS, queryFn: () => MasterDataService.getShifts() });
}

// ─── USER HOOKS ───────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery({ queryKey: QK.USERS, queryFn: () => UserService.list() });
}

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: QK.USER(userId!),
    queryFn: () => UserService.get(userId!),
    enabled: !!userId,
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => UserService.toggleActive(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.USERS }),
  });
}

// ─── INVENTORY HOOKS ──────────────────────────────────────────────────────────

export function useStock() {
  return useQuery({ queryKey: QK.STOCK, queryFn: () => InventoryService.getStock() });
}

export function useStockByCategory(category: string | undefined) {
  return useQuery({
    queryKey: QK.STOCK_BY_CATEGORY(category!),
    queryFn: () => InventoryService.getStockByCategory(category!),
    enabled: !!category,
  });
}

export function useCategories() {
  return useQuery({ queryKey: QK.CATEGORIES, queryFn: () => InventoryService.getCategories() });
}

export function useWarehouses() {
  return useQuery({ queryKey: QK.WAREHOUSES, queryFn: () => InventoryService.getWarehouses() });
}

export function usePackagingConfigs(productId: string | undefined) {
  return useQuery({
    queryKey: QK.PACKING_CONFIGS(productId!),
    queryFn: () => InventoryService.getPackagingConfigs(productId!),
    enabled: !!productId,
  });
}

export function useLedger(stockId: string | undefined) {
  return useQuery({
    queryKey: QK.LEDGER(stockId!),
    queryFn: () => InventoryService.getLedger(stockId!),
    enabled: !!stockId,
  });
}

// ─── ANALYTICS HOOKS ──────────────────────────────────────────────────────────

export function useKpis() {
  return useQuery({ queryKey: QK.KPIS, queryFn: () => AnalyticsService.getKpis() });
}

export function useLinePerformance(lineId?: string) {
  return useQuery({
    queryKey: QK.LINE_PERF(lineId),
    queryFn: () => AnalyticsService.getLinePerformance(lineId ? { lineId } : undefined),
    refetchInterval: 5_000,
  });
}

export function useFactoryLive() {
  return useQuery({
    queryKey: QK.FACTORY_LIVE,
    queryFn: () => AnalyticsService.getFactoryLive(),
    refetchInterval: 10_000,
  });
}

// ─── BIOMETRIC HOOKS ──────────────────────────────────────────────────────────

export function useBiometricDevices() {
  return useQuery({ queryKey: QK.DEVICES, queryFn: () => BiometricService.getDevices() });
}

export function useAttendanceToday() {
  return useQuery({
    queryKey: QK.ATTENDANCE_TODAY,
    queryFn: () => BiometricService.getAttendanceToday(),
    refetchInterval: 60_000,
  });
}

export function useMonthlyAttendanceReport(userId: string, month: number, year: number) {
  return useQuery({
    queryKey: QK.MONTHLY_REPORT(userId, month, year),
    queryFn: () => BiometricService.getMonthlyReport({ userId, month, year }),
    enabled: !!userId,
  });
}

// ─── NOTES HOOKS ─────────────────────────────────────────────────────────────

export function useNotes(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...QK.NOTES, params],
    queryFn: () => NotesService.list(params),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNotePayload) => NotesService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.NOTES }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => NotesService.delete(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.NOTES }),
  });
}

// ─── NOTIFICATION HOOKS ───────────────────────────────────────────────────────

export function useUnreadNotifications() {
  return useQuery({
    queryKey: QK.NOTIFICATIONS,
    queryFn: () => NotificationService.getUnread(),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => NotificationService.markRead(notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.NOTIFICATIONS }),
  });
}
