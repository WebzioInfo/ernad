/**
 * ERNAD MES – API SERVICE CONTRACTS
 * All endpoints reference constants/endpoints.ts.
 * Payload shapes are inferred from actual backend DTOs + schema.
 * DO NOT add endpoints that don't exist in the backend.
 */

import { api } from './api-client';
import { ENDPOINTS } from '../constants/endpoints';
import type {
  AuthUser,
  ProductionBatch,
  ProductionBatchExpanded,
  ProductionLog,
  OperatorSession,
  DowntimeLog,
  PackagingLog,
  DispatchLog,
  BatchTotal,
  InventoryStock,
  InventoryLedger,
  PackagingConfiguration,
  RawMaterial,
  WarehouseLocation,
  StockTransfer,
  ProductionLine,
  ProductBrand,
  Product,
  Shift,
  User,
  AuditLog,
  BiometricDevice,
  DailyAttendance,
  MonthlyAttendanceSummary,
  Note,
  Terminal
} from '../types/database.types';

// ─── AUTH ────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  identity: string;     // username or email
  credential: string;  // password or PIN
  type: 'PASSWORD' | 'PIN';
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

export const AuthService = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, payload).then(r => r.data),

  logout: () =>
    api.post(ENDPOINTS.AUTH.LOGOUT).then(r => r.data),

  me: () =>
    api.get<AuthUser>(ENDPOINTS.AUTH.ME).then(r => r.data),
};

// ─── PRODUCTION ───────────────────────────────────────────────────────────────

export interface StartBatchPayload {
  lineId: string;
  brandId: string;
  productId: string;
  shiftId: string;
  batchCode?: string;
  remarks?: string;
  startTime: string;       // ISO string
  targetQuantity?: number;
  operatorIds?: string[];
}

export interface CloseBatchPayload {
  remarks?: string;
  endTime?: string;        // ISO string
  materialReturn?: Record<string, number>;
}

export const ProductionService = {
  getBatches: (params?: Record<string, string>) =>
    api.get<ProductionBatchExpanded[]>(ENDPOINTS.PRODUCTION.BATCHES, { params }).then(r => r.data),

  getActiveBatch: (lineId: string) =>
    api.get<{ batch: ProductionBatchExpanded; productName?: string }>(
      ENDPOINTS.PRODUCTION.ACTIVE_BATCH(lineId)
    ).then(r => r.data),

  startBatch: (payload: StartBatchPayload) =>
    api.post<ProductionBatch>(ENDPOINTS.PRODUCTION.START_BATCH, payload).then(r => r.data),

  closeBatch: (batchId: string, payload: CloseBatchPayload) =>
    api.patch(ENDPOINTS.PRODUCTION.CLOSE_BATCH(batchId), payload).then(r => r.data),

  reopenBatch: (batchId: string, reason: string) =>
    api.post(ENDPOINTS.PRODUCTION.REOPEN_BATCH(batchId), { reason }).then(r => r.data),

  requestApproval: (batchId: string) =>
    api.post(ENDPOINTS.PRODUCTION.REQUEST_APPROVAL(batchId)).then(r => r.data),

  approveBatch: (batchId: string) =>
    api.post(ENDPOINTS.PRODUCTION.APPROVE_BATCH(batchId)).then(r => r.data),

  adjustTime: (batchId: string, payload: { startTime?: string; endTime?: string; reason?: string }) =>
    api.patch(ENDPOINTS.PRODUCTION.ADJUST_TIME(batchId), payload).then(r => r.data),

  initiateChangeover: (lineId: string, payload: { batchId: string; productId: string }) =>
    api.post(ENDPOINTS.PRODUCTION.LINE_CHANGEOVER(lineId), payload).then(r => r.data),

  completeChangeover: (batchId: string) =>
    api.post(ENDPOINTS.PRODUCTION.COMPLETE_CHANGEOVER(batchId)).then(r => r.data),

  toggleMaintenance: (lineId: string) =>
    api.post(ENDPOINTS.PRODUCTION.TOGGLE_MAINTENANCE(lineId)).then(r => r.data),

  logPackaging: (payload: {
    batchId: string;
    operatorId: string;
    packType: string;
    quantity: number;
    unitsPerPack: number;
    remarks?: string;
  }) =>
    api.post<PackagingLog>(ENDPOINTS.PRODUCTION.PACKAGING_LOGS, payload).then(r => r.data),

  logDispatch: (payload: {
    batchId: string;
    managerId: string;
    destination: string;
    quantity: number;
    vehicleNumber?: string;
    remarks?: string;
  }) =>
    api.post<DispatchLog>(ENDPOINTS.PRODUCTION.DISPATCH_LOGS, payload).then(r => r.data),

  getLifecycleLogs: (type: 'packaging' | 'dispatch') =>
    api.get(ENDPOINTS.PRODUCTION.LOGS(type)).then(r => r.data),

  reassignOperators: (batchId: string, operatorIds: string[]) =>
    api.post(ENDPOINTS.PRODUCTION.REASSIGN_OPERATORS(batchId), { operatorIds }).then(r => r.data),
};

// ─── TELEMETRY ────────────────────────────────────────────────────────────────

/** Shape of the telemetry POST body, aligned with productionLogs schema */
export interface TelemetryLogPayload {
  requestId: string;       // UUID – client-generated idempotency key
  batchId: string;
  sessionId?: string;
  lineId: string;
  brandId: string;
  productId: string;
  shiftId: string;
  station: 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';
  primaryCount: number;
  wastageCount: number;
  secondaryPackagingCount?: number;
  eventType?: string;      // defaults to NORMAL_PRODUCTION
  isRework?: boolean;
  remarks?: string;
  loggedAt: string;        // ISO string – actual production time
  // Station-specific material fields
  preformUsage?: number;
  preformRejection?: number;
  capUsage?: number;
  capBoxUsage?: number;
  capRejection?: number;
  rawMaterialId?: string;
  bagsUsed?: number;
  bopRollUsage?: number;   // label roll meters
  bopRejection?: number;
  inkUsage?: number;
  solventUsage?: number;
  shrinkWeightUsed?: number;
  boxesUsed?: number;
  labelsUsed?: number;
  shrinkRollsUsed?: number;
  finishedGoodsProduced?: number;
  casesProduced?: number;
  packingTypeId?: string;
  // Inventory linkage
  selectedStockId?: string;
}

export const TelemetryService = {
  log: (payload: TelemetryLogPayload) =>
    api.post(ENDPOINTS.TELEMETRY.LOGS, payload).then(r => r.data),

  getHistory: (batchId: string, station: string) =>
    api.get<ProductionLog[]>(ENDPOINTS.TELEMETRY.HISTORY(batchId, station)).then(r => r.data),

  getActiveEvents: (batchId: string) =>
    api.get<DowntimeLog[]>(ENDPOINTS.TELEMETRY.ACTIVE_EVENTS(batchId)).then(r => r.data),

  getReconciliation: (batchId: string) =>
    api.get<BatchTotal>(ENDPOINTS.TELEMETRY.RECONCILIATION(batchId)).then(r => r.data),

  patchLog: (logId: string, payload: Partial<TelemetryLogPayload>) =>
    api.patch(ENDPOINTS.TELEMETRY.PATCH_LOG(logId), payload).then(r => r.data),
};

// ─── OPERATOR SESSIONS ────────────────────────────────────────────────────────

export const OperatorSessionService = {
  getCurrent: () =>
    api.get<OperatorSession>(ENDPOINTS.OPERATOR_SESSIONS.CURRENT).then(r => r.data),

  getActive: () =>
    api.get<OperatorSession[]>(ENDPOINTS.OPERATOR_SESSIONS.ACTIVE).then(r => r.data),

  getRecent: () =>
    api.get<OperatorSession[]>(ENDPOINTS.OPERATOR_SESSIONS.RECENT).then(r => r.data),

  start: (payload: { lineId: string; station: string; batchId?: string }) =>
    api.post<OperatorSession>(ENDPOINTS.OPERATOR_SESSIONS.START, payload).then(r => r.data),

  end: () =>
    api.post(ENDPOINTS.OPERATOR_SESSIONS.END).then(r => r.data),

  changeStation: (station: string) =>
    api.post(ENDPOINTS.OPERATOR_SESSIONS.CHANGE_STATION, { station }).then(r => r.data),
};

// ─── MASTER DATA ──────────────────────────────────────────────────────────────

export const MasterDataService = {
  getLines: () =>
    api.get<ProductionLine[]>(ENDPOINTS.MASTER_DATA.LINES).then(r => r.data),

  getLine: (lineId: string) =>
    api.get<ProductionLine>(ENDPOINTS.MASTER_DATA.LINE(lineId)).then(r => r.data),

  getBrands: () =>
    api.get<ProductBrand[]>(ENDPOINTS.MASTER_DATA.BRANDS).then(r => r.data),

  getProducts: () =>
    api.get<Product[]>(ENDPOINTS.MASTER_DATA.PRODUCTS).then(r => r.data),

  getShifts: () =>
    api.get<Shift[]>(ENDPOINTS.MASTER_DATA.SHIFTS).then(r => r.data),

  getShift: (shiftId: string) =>
    api.get<Shift>(ENDPOINTS.MASTER_DATA.SHIFT(shiftId)).then(r => r.data),

  getRawMaterials: () =>
    api.get<RawMaterial[]>(ENDPOINTS.MASTER_DATA.RAW_MATERIALS).then(r => r.data),

  deleteRawMaterial: (id: string) =>
    api.delete(ENDPOINTS.MASTER_DATA.DELETE_RAW_MATERIAL(id)).then(r => r.data),

  updateRawMaterial: (id: string, data: Partial<RawMaterial>) =>
    api.patch(ENDPOINTS.MASTER_DATA.UPDATE_RAW_MATERIAL(id), data).then(r => r.data),
};

// ─── USERS ────────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  name: string;
  username: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  factoryId?: string;
  roleIds: string[];
}

export const UserService = {
  list: () =>
    api.get<User[]>(ENDPOINTS.USERS.LIST).then(r => r.data),

  get: (userId: string) =>
    api.get<User>(ENDPOINTS.USERS.GET(userId)).then(r => r.data),

  create: (payload: CreateUserPayload) =>
    api.post<User>(ENDPOINTS.USERS.CREATE, payload).then(r => r.data),

  update: (userId: string, payload: Partial<CreateUserPayload>) =>
    api.put<User>(ENDPOINTS.USERS.UPDATE(userId), payload).then(r => r.data),

  toggleActive: (userId: string) =>
    api.patch(ENDPOINTS.USERS.TOGGLE_ACTIVE(userId)).then(r => r.data),

  resetPin: (userId: string, pin: string) =>
    api.patch(ENDPOINTS.USERS.RESET_PIN(userId), { pin }).then(r => r.data),

  getAuditLogs: () =>
    api.get<AuditLog[]>(ENDPOINTS.USERS.AUDIT_LOGS).then(r => r.data),

  getUserAuditLogs: (userId: string) =>
    api.get<AuditLog[]>(ENDPOINTS.USERS.USER_AUDIT_LOGS(userId)).then(r => r.data),
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export const InventoryService = {
  getStock: () =>
    api.get<InventoryStock[]>(ENDPOINTS.INVENTORY.STOCK).then(r => r.data),

  getStockByCategory: (category: string) =>
    api.get<InventoryStock[]>(ENDPOINTS.INVENTORY.STOCK_BY_CATEGORY(category)).then(r => r.data),


  getWarehouses: () =>
    api.get<WarehouseLocation[]>(ENDPOINTS.INVENTORY.WAREHOUSES).then(r => r.data),

  getTransfers: () =>
    api.get<StockTransfer[]>(ENDPOINTS.INVENTORY.TRANSFERS).then(r => r.data),

  completeTransfer: (transferId: string) =>
    api.patch(ENDPOINTS.INVENTORY.TRANSFER_COMPLETE(transferId)).then(r => r.data),

  getPackagingConfigs: (productId: string) =>
    api.get<PackagingConfiguration[]>(ENDPOINTS.INVENTORY.PACKAGING(productId)).then(r => r.data),

  getLedger: (stockId: string) =>
    api.get<InventoryLedger[]>(ENDPOINTS.INVENTORY.LEDGER(stockId)).then(r => r.data),

  getRawMaterials: () =>
    api.get<any[]>(ENDPOINTS.INVENTORY.RAW_MATERIALS).then(r => r.data),

  getStationConsumption: () =>
    api.get<any>(ENDPOINTS.INVENTORY.STATION_CONSUMPTION).then(r => r.data),

  getProductionStock: () =>
    api.get<any[]>(ENDPOINTS.INVENTORY.PRODUCTION_STOCK).then(r => r.data),

  getRawMaterialLedger: (id: string) =>
    api.get<any[]>(ENDPOINTS.INVENTORY.RAW_MATERIAL_LEDGER(id)).then(r => r.data),

  getProductLedger: (id: string) =>
    api.get<any[]>(ENDPOINTS.INVENTORY.PRODUCT_LEDGER(id)).then(r => r.data),
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export const AnalyticsService = {
  getKpis: () =>
    api.get(ENDPOINTS.ANALYTICS.KPIS).then(r => r.data),

  getLinePerformance: (params?: { lineId?: string }) =>
    api.get(ENDPOINTS.ANALYTICS.LINE_PERFORMANCE, { params }).then(r => r.data),

  getHistorical: (params?: Record<string, string>) =>
    api.get(ENDPOINTS.ANALYTICS.HISTORICAL, { params }).then(r => r.data),

  getFactoryLive: () =>
    api.get(ENDPOINTS.ANALYTICS.FACTORY_LIVE).then(r => r.data),

  getFactoryEfficiency: () =>
    api.get(ENDPOINTS.ANALYTICS.FACTORY_EFFICIENCY).then(r => r.data),
};

// ─── BIOMETRIC ────────────────────────────────────────────────────────────────

export const BiometricService = {
  getDevices: () =>
    api.get<BiometricDevice[]>(ENDPOINTS.BIOMETRIC.DEVICES).then(r => r.data),

  getDevice: (deviceId: string) =>
    api.get<BiometricDevice>(ENDPOINTS.BIOMETRIC.DEVICE(deviceId)).then(r => r.data),

  testDevice: (deviceId: string) =>
    api.post(ENDPOINTS.BIOMETRIC.TEST(deviceId)).then(r => r.data),

  syncDevice: (deviceId: string) =>
    api.post(ENDPOINTS.BIOMETRIC.SYNC(deviceId)).then(r => r.data),

  getLogs: () =>
    api.get(ENDPOINTS.BIOMETRIC.LOGS).then(r => r.data),

  getUnmapped: () =>
    api.get(ENDPOINTS.BIOMETRIC.UNMAPPED).then(r => r.data),

  mapUser: (payload: { deviceUserId: string; userId: string }) =>
    api.post(ENDPOINTS.BIOMETRIC.MAP_USER, payload).then(r => r.data),

  getAttendanceToday: () =>
    api.get<DailyAttendance[]>(ENDPOINTS.BIOMETRIC.ATTENDANCE_TODAY).then(r => r.data),

  getAttendance: (userId: string) =>
    api.get<DailyAttendance[]>(ENDPOINTS.BIOMETRIC.ATTENDANCE(userId)).then(r => r.data),

  getShifts: () =>
    api.get<Shift[]>(ENDPOINTS.BIOMETRIC.SHIFTS).then(r => r.data),

  assignShift: (payload: { userId: string; shiftId: string; effectiveFrom: string }) =>
    api.post(ENDPOINTS.BIOMETRIC.ASSIGN_SHIFT, payload).then(r => r.data),

  getMonthlyReport: (params: { userId?: string; month: number; year: number }) =>
    api.get<MonthlyAttendanceSummary[]>(ENDPOINTS.BIOMETRIC.REPORT_MONTHLY, { params }).then(r => r.data),
};

// ─── TERMINALS ────────────────────────────────────────────────────────────────

export const TerminalService = {
  getOperators: () =>
    api.get(ENDPOINTS.TERMINALS.OPERATORS).then(r => r.data),

  register: (payload: { code: string; name: string; factoryId: string; lineId?: string }) =>
    api.post<Terminal>(ENDPOINTS.TERMINALS.REGISTER, payload).then(r => r.data),

  getState: (terminalId: string) =>
    api.get(ENDPOINTS.TERMINALS.STATE(terminalId)).then(r => r.data),

  activate: (payload: { terminalId: string; deviceId: string }) =>
    api.post(ENDPOINTS.TERMINALS.ACTIVATE, payload).then(r => r.data),

  verifyOperator: (payload: { identity: string; credential: string; type: 'PASSWORD' | 'PIN' }) =>
    api.post(ENDPOINTS.TERMINALS.AUTH_LOGIN, payload).then(r => r.data),
};

// ─── NOTES ────────────────────────────────────────────────────────────────────

export interface CreateNotePayload {
  title: string;
  content: string;
  type: Note['type'];
  priority: Note['priority'];
  lineId?: string;
  shiftId?: string;
  productionBatchId?: string;
  machineId?: string;
  isPinned?: boolean;
  isPrivate?: boolean;
  tags?: string[];
}

export const NotesService = {
  list: (params?: Record<string, string>) =>
    api.get<Note[]>(ENDPOINTS.NOTES.LIST, { params }).then(r => r.data),

  get: (noteId: string) =>
    api.get<Note>(ENDPOINTS.NOTES.GET(noteId)).then(r => r.data),

  create: (payload: CreateNotePayload) =>
    api.post<Note>(ENDPOINTS.NOTES.CREATE, payload).then(r => r.data),

  update: (noteId: string, payload: Partial<CreateNotePayload>) =>
    api.put<Note>(ENDPOINTS.NOTES.UPDATE(noteId), payload).then(r => r.data),

  delete: (noteId: string) =>
    api.delete(ENDPOINTS.NOTES.DELETE(noteId)).then(r => r.data),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const NotificationService = {
  getUnread: () =>
    api.get(ENDPOINTS.NOTIFICATIONS.UNREAD).then(r => r.data),

  markRead: (notificationId: string) =>
    api.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId)).then(r => r.data),
};

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export const ReportService = {
  getProduction: (params?: Record<string, string>) =>
    api.get(ENDPOINTS.REPORTS.PRODUCTION, { params }).then(r => r.data),

  getBatches: (params?: Record<string, string>) =>
    api.get(ENDPOINTS.REPORTS.BATCHES, { params }).then(r => r.data),

  getAttendance: (params?: Record<string, string>) =>
    api.get(ENDPOINTS.REPORTS.ATTENDANCE, { params }).then(r => r.data),

  getBatchDossier: (batchId: string) =>
    api.get(ENDPOINTS.REPORTS.BATCH_DOSSIER(batchId)).then(r => r.data),

  getSales: (params?: Record<string, string>) =>
    api.get(ENDPOINTS.REPORTS.SALES, { params }).then(r => r.data),
};

// ─── SALES TRANSACTIONS ───────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CreateSalesTransactionPayload {
  brandId: string;
  productId: string;
  type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
  quantity: number;
  salesDate: string;
  customerId?: string;
  unitPrice?: number;
  remarks?: string;
}

export interface SalesTransaction {
  id: string;
  brandId: string;
  brandName: string;
  productId: string;
  productName: string;
  type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
  quantity: number;
  performedBy: string;
  userName: string;
  salesDate: string;
  customerId?: string;
  customerName?: string;
  unitPrice?: string;
  remarks?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const SalesService = {
  getSalesTransactions: () =>
    api.get<SalesTransaction[]>(ENDPOINTS.SALES.TRANSACTIONS).then(r => r.data),

  createSalesTransaction: (payload: CreateSalesTransactionPayload) =>
    api.post<SalesTransaction>(ENDPOINTS.SALES.TRANSACTIONS, payload).then(r => r.data),

  updateSalesTransaction: (id: string, payload: CreateSalesTransactionPayload) =>
    api.patch<SalesTransaction>(ENDPOINTS.SALES.TRANSACTION(id), payload).then(r => r.data),

  deleteSalesTransaction: (id: string) =>
    api.delete<{ success: boolean }>(ENDPOINTS.SALES.TRANSACTION(id)).then(r => r.data),

  getCustomers: () =>
    api.get<Customer[]>(ENDPOINTS.SALES.CUSTOMERS).then(r => r.data),
};
