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
  SalesService,
  BackupService,
  type StartBatchPayload,
  type CloseBatchPayload,
  type TelemetryLogPayload,
  type CreateNotePayload,
  type CreateSalesTransactionPayload,
  type Customer,
  type SalesTransaction,
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

  WAREHOUSES: ['inventory-warehouses'] as const,
  TRANSFERS: ['inventory-transfers'] as const,
  PACKING_CONFIGS: (productId: string) => ['packing-configs', productId] as const,
  LEDGER: (stockId: string) => ['ledger', stockId] as const,
  RAW_MATERIALS_STOCK: ['raw-materials-stock'] as const,
  PRODUCTION_STOCK: ['production-stock'] as const,
  STATION_CONSUMPTION: ['station-consumption'] as const,
  RAW_MATERIAL_LEDGER: (id: string) => ['raw-material-ledger', id] as const,
  PRODUCT_LEDGER: (id: string) => ['product-ledger', id] as const,
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
  // Sales
  SALES_TRANSACTIONS: ['sales-transactions'] as const,
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

    retry: 1,
  });
}

export function useStartBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartBatchPayload) => ProductionService.startBatch(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.LINES });
      qc.invalidateQueries({ queryKey: ['active-batch'] });
      qc.invalidateQueries({ queryKey: QK.BATCHES });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCloseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: CloseBatchPayload }) =>
      ProductionService.closeBatch(batchId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.LINES });
      qc.invalidateQueries({ queryKey: ['active-batch'] });
      qc.invalidateQueries({ queryKey: QK.BATCHES });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReopenBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, reason }: { batchId: string; reason: string }) =>
      ProductionService.reopenBatch(batchId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.LINES });
      qc.invalidateQueries({ queryKey: ['active-batch'] });
      qc.invalidateQueries({ queryKey: QK.BATCHES });
    },
  });
}


export function useInitiateChangeover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: string; payload: { batchId: string; productId: string } }) =>
      ProductionService.initiateChangeover(lineId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.LINES });
      qc.invalidateQueries({ queryKey: ['active-batch'] });
    },
  });
}

export function useCompleteChangeover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => ProductionService.completeChangeover(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.LINES });
      qc.invalidateQueries({ queryKey: ['active-batch'] });
    },
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
  return useQuery({
    queryKey: QK.PRODUCTS,
    queryFn: async () => {
      try {
        return await MasterDataService.getProducts();
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[useProducts] Failed to fetch products', err);
        throw err;
      }
    },
    // Provide a small retry window and an empty initial value so components can render deterministically
    retry: 1,
    initialData: [],
  });
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

export function useRawMaterials() {
  return useQuery({ queryKey: QK.RAW_MATERIALS_STOCK, queryFn: () => InventoryService.getRawMaterials() });
}

export function useProductionStock() {
  return useQuery({ queryKey: QK.PRODUCTION_STOCK, queryFn: () => InventoryService.getProductionStock() });
}

export function useStationConsumption() {
  return useQuery({ queryKey: QK.STATION_CONSUMPTION, queryFn: () => InventoryService.getStationConsumption() });
}

export function useRawMaterialLedger(id: string | undefined) {
  return useQuery({
    queryKey: QK.RAW_MATERIAL_LEDGER(id!),
    queryFn: () => InventoryService.getRawMaterialLedger(id!),
    enabled: !!id,
  });
}

export function useProductLedger(id: string | undefined) {
  return useQuery({
    queryKey: QK.PRODUCT_LEDGER(id!),
    queryFn: () => InventoryService.getProductLedger(id!),
    enabled: !!id,
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

  });
}

export function useFactoryLive() {
  return useQuery({
    queryKey: QK.FACTORY_LIVE,
    queryFn: () => AnalyticsService.getFactoryLive(),

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

  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => NotificationService.markRead(notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.NOTIFICATIONS }),
  });
}

// ─── SALES HOOKS ──────────────────────────────────────────────────────────────

export function useCustomers() {
  return useQuery({
    queryKey: ['sales-customers'],
    queryFn: () => SalesService.getCustomers(),
  });
}

export function useCustomersFiltered(params: any) {
  return useQuery({
    queryKey: ['sales-customers-filtered', params],
    queryFn: () => SalesService.getCustomersFiltered(params),
  });
}

export function useCustomerById(id: string) {
  return useQuery({
    queryKey: ['sales-customer', id],
    queryFn: () => SalesService.getCustomerById(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Customer>) => SalesService.createCustomer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-customers'] });
      qc.invalidateQueries({ queryKey: ['sales-customers-filtered'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Customer> }) =>
      SalesService.updateCustomer(id, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['sales-customers'] });
      qc.invalidateQueries({ queryKey: ['sales-customers-filtered'] });
      qc.invalidateQueries({ queryKey: ['sales-customer', variables.id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => SalesService.deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-customers'] });
      qc.invalidateQueries({ queryKey: ['sales-customers-filtered'] });
    },
  });
}

export function useCustomerSummary(id: string, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-summary', id],
    queryFn: () => SalesService.getCustomerSummary(id),
    enabled: !!id,
    ...options
  });
}

export function useCustomerLedger(id: string, params?: any, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-ledger', id, params],
    queryFn: () => SalesService.getCustomerLedger(id, params),
    enabled: !!id,
    ...options
  });
}

export function useCustomerSales(id: string, params?: any, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-sales', id, params],
    queryFn: () => SalesService.getCustomerSales(id, params),
    enabled: !!id,
    ...options
  });
}

export function useCustomerPayments(id: string, params?: any, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-payments', id, params],
    queryFn: () => SalesService.getCustomerPayments(id, params),
    enabled: !!id,
    ...options
  });
}

export function useCustomerReturns(id: string, params?: any, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-returns', id, params],
    queryFn: () => SalesService.getCustomerReturns(id, params),
    enabled: !!id,
    ...options
  });
}

export function useCustomerDamages(id: string, params?: any, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-damages', id, params],
    queryFn: () => SalesService.getCustomerDamages(id, params),
    enabled: !!id,
    ...options
  });
}

export function useCustomerActivities(id: string, options?: any) {
  return useQuery({
    queryKey: ['sales-customer-activities', id],
    queryFn: () => SalesService.getCustomerActivities(id),
    enabled: !!id,
    ...options
  });
}

export function useSalesTransactions() {
  return useQuery<SalesTransaction[], Error>({
    queryKey: QK.SALES_TRANSACTIONS,
    queryFn: async () => {
      try {
        return await SalesService.getSalesTransactions();
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[useSalesTransactions] Failed to fetch sales transactions', err);
        throw err;
      }
    },
    retry: 1,
    placeholderData: (previousData) => previousData,
    staleTime: 60000,
  });
}

export function useCreateSalesTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSalesTransactionPayload) => SalesService.createSalesTransaction(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.SALES_TRANSACTIONS });
      qc.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
    },
  });
}

export function useUpdateSalesTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateSalesTransactionPayload }) =>
      SalesService.updateSalesTransaction(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.SALES_TRANSACTIONS });
      qc.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
    },
  });
}

export function useDeleteSalesTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => SalesService.deleteSalesTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.SALES_TRANSACTIONS });
      qc.invalidateQueries({ queryKey: QK.PRODUCTION_STOCK });
    },
  });
}

// ─── BACKUP & RESTORE HOOKS ───────────────────────────────────────────────────

export function useBackupHistory() {
  return useQuery({
    queryKey: ['backup-history'],
    queryFn: () => BackupService.getHistory(),
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => BackupService.createBackup(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-history'] });
    },
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => BackupService.deleteBackup(filename),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-history'] });
    },
  });
}

export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (param: { filename?: string; file?: File; onProgress?: (percent: number) => void }) => {
      if (param.file) {
        return BackupService.restoreFromFile(param.file, param.onProgress);
      } else if (param.filename) {
        return BackupService.restoreFromHistory(param.filename);
      }
      throw new Error('Must specify either filename or file to restore.');
    },
    onSuccess: () => {
      qc.invalidateQueries(); // Invalidate all query cache since data is overwritten
    },
  });
}
