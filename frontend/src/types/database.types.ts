// ─────────────────────────────────────────────────────────────────────────────
// ERNAD MES – DATABASE-FIRST FRONTEND TYPES
// Source of truth: backend/src/database/schema/*
// DO NOT invent fields. Every field maps 1:1 to a real DB column.
// ─────────────────────────────────────────────────────────────────────────────

// ── ENUMS (exact match to pgEnum declarations) ──────────────────────────────

export type BatchStatus =
  | 'PLANNING'
  | 'RUNNING'
  | 'CHANGEOVER'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CLOSED';

export type StationType = 'BLOWING' | 'FILLING' | 'LABELING' | 'PACKING';

export type EventType =
  | 'POWER_FAILURE'
  | 'MACHINE_BREAKDOWN'
  | 'LOW_SPEED'
  | 'MATERIAL_SHORTAGE'
  | 'NORMAL_PRODUCTION'
  | 'BATCH_START'
  | 'BATCH_END'
  | 'DOWNTIME_PAUSE';


export type TerminalType = 'PRODUCTION' | 'MAINTENANCE' | 'SUPERVISOR' | 'KIOSK';
export type TerminalStatus = 'OFFLINE' | 'ONLINE' | 'MAINTENANCE' | 'LOCKED';
export type TerminalTrustMode =
  | 'STRICT_KIOSK'
  | 'FLEXIBLE_AUTH'
  | 'TEMPORARY_SESSION'
  | 'MOBILE_OPERATOR';

export type NoteType =
  | 'GENERAL'
  | 'PRODUCTION'
  | 'MAINTENANCE'
  | 'SHIFT_HANDOVER'
  | 'INCIDENT'
  | 'BREAKDOWN'
  | 'ALERT'
  | 'STOCK';
export type NotePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PoStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';
export type GrnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export type OrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export type LineStatus = 'IDLE' | 'RUNNING' | 'CHANGEOVER' | 'MAINTENANCE';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ON_LEAVE';
export type DailyAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WarehouseType = 'RAW_MATERIAL' | 'FINISHED_GOODS' | 'QUARANTINE';
export type FinishedGoodsStatus = 'AVAILABLE' | 'QUARANTINED' | 'DISPATCHED';
export type StockTransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
export type InventoryLedgerType =
  | 'INWARD'
  | 'ISSUE'
  | 'CONSUMPTION'
  | 'WASTAGE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'PRODUCTION_OUTPUT'
  | 'DISPATCH';

// ── RBAC (users.ts) ──────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;         // e.g. "Plant Manager"
  slug: string;         // e.g. "SUPER_ADMIN" – used for auth checks
  description?: string | null;
  createdAt: string;
}

export interface Permission {
  id: string;
  name: string;         // e.g. "Edit Users"
  slug: string;         // e.g. "user:edit" – used in @Permissions() decorator
  category?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  /** Never expose on frontend – presence only */
  passwordHash?: undefined;
  pinCode?: undefined;
  /** @deprecated use operatorSessions.station instead */
  operatorType?: string | null;
  isActive: boolean;
  avatarUrl?: string | null;
  factoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** Shape returned by auth/me and auth/login */
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  factoryId?: string | null;
  sessionId?: string | null;
  /** Primary role slug (legacy compat) */
  role: string;
  /** All role slugs */
  roles: string[];
  /** All permission slugs e.g. "production:start" */
  permissions: string[];
}

export interface AttendanceLog {
  id: string;
  userId: string;
  clockIn: string;
  clockOut?: string | null;
  shiftId?: string | null;
  /** @deprecated use shiftId */
  shiftName?: string | null;
  status: AttendanceStatus;
  externalSyncId?: string | null;
  remarks?: string | null;
}

// ── MASTER DATA (master-data.ts) ─────────────────────────────────────────────

export interface Factory {
  id: string;
  name: string;
  code: string;
  location?: string | null;
  contactInfo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionLine {
  id: string;
  factoryId: string;
  name: string;
  description?: string | null;
  status: LineStatus;
  currentEfficiency?: string | null; // decimal stored as string
  createdAt: string;
  updatedAt: string;
}

export interface ProductBrand {
  id: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  brandId?: string | null;
  category?: string | null;
  factoryId?: string | null;
  targetBPM: number;
  createdAt: string;
}

// ── BIOMETRIC & ATTENDANCE (biometric.ts) ────────────────────────────────────

export interface BiometricDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  location?: string | null;
  isActive: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING';
  lastConnectedAt?: string | null;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiometricAttendanceLog {
  id: string;
  deviceId: string;
  deviceUserId: string;
  punchTime: string;
  punchType?: number | null;
  rawData?: Record<string, any> | null;
  source: string;
  uniqueHash: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm:ss
  endTime: string;   // HH:mm:ss
  graceMinutes: number;
  overtimeAfter?: number | null;
  minimumHours: number;
  shiftType: 'DAY' | 'NIGHT' | 'SPLIT' | 'GENERAL';
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeShiftAssignment {
  id: string;
  userId: string;
  shiftId: string;
  effectiveFrom: string; // date string YYYY-MM-DD
  effectiveTo?: string | null;
  createdAt: string;
}

export interface DailyAttendance {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  shiftId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  workedHours?: string | null;
  status: DailyAttendanceStatus;
  lateMinutes: number;
  overtimeMinutes: number;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAttendanceSummary {
  id: string;
  userId: string;
  month: number;
  year: number;
  totalPresent: number;
  totalAbsent: number;
  totalHalfDays: number;
  totalLates: number;
  totalOvertimeMinutes: number;
  netPayableDays?: string | null;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── TERMINALS (terminals.ts) ─────────────────────────────────────────────────

export interface Terminal {
  id: string;
  code: string;
  name: string;
  type: TerminalType;
  factoryId: string;
  lineId?: string | null;
  department?: string | null;
  deviceId?: string | null;
  trustMode: TerminalTrustMode;
  /** @deprecated use deviceId */
  macAddress?: string | null;
  ipAddress?: string | null;
  status: TerminalStatus;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalSession {
  id: string;
  terminalId: string;
  supervisorId: string;
  shiftId: string;
  startTime: string;
  endTime?: string | null;
  isActive: boolean;
  authMetadata?: string | null;
}

// ── PRODUCTION (production.ts) ───────────────────────────────────────────────

export interface ProductionBatch {
  id: string;
  batchCode: string;
  lineId: string;
  brandId: string;
  productId: string;
  shiftId: string;
  factoryId: string;
  targetQuantity?: number | null;
  startTime: string;
  endTime?: string | null;
  adjustedStartTime?: string | null;
  adjustedBy?: string | null;
  status: BatchStatus;
  isLocked: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  closedBy?: string | null;
  closedAt?: string | null;
  remarks?: string | null;
  materialReturn?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
}

export interface OperatorSession {
  id: string;
  userId: string;
  lineId: string;
  batchId?: string | null;
  /** Maps to station_type column */
  station: StationType;
  shiftId?: string | null;
  factoryId?: string | null;
  startTime: string;
  endTime?: string | null;
  terminalId?: string | null;
  isActive: boolean;
  endedBy?: string | null;
  endReason?: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface DowntimeLog {
  id: string;
  batchId: string;
  lineId: string;
  factoryId: string;
  station: string;
  reason: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
}

export interface ChangeoverLog {
  id: string;
  batchId: string;
  lineId: string;
  fromProductId: string;
  toProductId: string;
  startTime: string;
  endTime?: string | null;
  leftoverMaterials: Record<string, any>;
  wastedMaterials: Record<string, any>;
  createdBy?: string | null;
  createdAt: string;
}

export interface MaterialFlow {
  id: number;
  batchId: string;
  materialName: string;
  issued: number;
  used: number;
  wasted: number;
  loggedAt: string;
}

// ── LOGS / TELEMETRY (logs.ts) ───────────────────────────────────────────────

export interface ProductionLog {
  id: number; // bigserial
  requestId: string; // uuid idempotency key – must be sent from frontend
  batchId: string;
  lineId: string;
  shiftId: string;
  brandId: string;
  productId: string;
  userId: string;
  terminalId?: string | null;
  sessionId?: string | null;
  factoryId: string;
  station: StationType;
  primaryCount: number;
  splitValues: number[];
  wastageCount: number | string;
  bottleLeakage?: number | null;
  capWastage?: number | null;
  eventType: EventType;
  isRework: boolean;
  remarks?: string | null;
  // Material consumption
  capUsage?: number | null;
  preformUsage?: number | null;
  rawMaterialId?: string | null;
  bagsUsed?: string | null;
  bopRollUsage?: string | null;
  shrinkWeightUsed?: string | null;
  inkUsage?: string | null;
  solventUsage?: string | null;
  labelUsage?: number | null;
  casesProduced?: number | null;
  packingTypeId?: string | null;
  finishedGoodsProduced?: number | null;
  materialCost?: string | null;
  boxCount?: number | null;
  secondaryPackagingCount: number;
  // Timestamps
  loggedAt: string;
  receivedAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
  // Soft delete
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
}

/** Atomic running totals per batch – primary dashboard source */
export interface BatchTotal {
  batchId: string;
  lineId: string;
  factoryId: string;
  blowingTotal: number;
  fillingTotal: number;
  labelingTotal: number;
  packingTotal: number;
  scrapTotal: string;
  capTotal: number;
  preformTotal: number;
  bagsTotal: string;
  bopRollTotal: string;
  shrinkWeightTotal: string;
  inkTotal: string;
  solventTotal: string;
  finishedGoodsTotal: number;
  casesTotal: number;
  updatedAt: string;
}


export interface PackagingLog {
  id: string;
  batchId: string;
  factoryId: string;
  operatorId: string;
  packType: string;
  quantity: number;
  unitsPerPack: number;
  remarks?: string | null;
  createdAt: string;
}

export interface DispatchLog {
  id: string;
  batchId: string;
  factoryId: string;
  dispatchManagerId: string;
  destination: string;
  quantity: number;
  vehicleNumber?: string | null;
  remarks?: string | null;
  dispatchedAt: string;
}

export interface AuditLog {
  id: number;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  /** AUTH | PRODUCTION | TELEMETRY | INVENTORY | SALES | SECURITY | GENERAL */
  category: string;
  requestId?: string | null;
  payload?: Record<string, any> | null;
  occurredAt: string;
}

export interface Notification {
  id: string;
  /** LOW_EFFICIENCY | HIGH_REJECTION | MACHINE_ISSUE | BATCH_MILESTONE */
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isRead: boolean;
  createdAt: string;
}

// ── INVENTORY (inventory.ts) ─────────────────────────────────────────────────

export interface RawMaterial {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
}

export interface WarehouseLocation {
  id: string;
  factoryId: string;
  name: string;
  type: WarehouseType;
  createdAt: string;
}

export interface SupplierBatch {
  id: string;
  batchNumber: string;
  supplierName?: string | null;
  receivedAt: string;
  expiryDate?: string | null;
}

export interface InventoryStock {
  id: string;
  factoryId: string;
  warehouseId: string;
  categoryId?: string | null;
  itemName: string;
  sku?: string | null;
  unit: string;
  quantity: string; // decimal
  minimumStock: string; // decimal
  valuationRate?: string | null;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  stockId: string;
  /** IN | OUT | ADJUSTMENT | REJECTION | CONSUMPTION */
  type: string;
  quantityChange: string;
  balanceAfter: string;
  referenceId?: string | null;
  remarks?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface FinishedGoodsInventory {
  id: string;
  factoryId: string;
  productId: string;
  warehouseId: string;
  status: FinishedGoodsStatus;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingConfiguration {
  id: string;
  productId: string;
  name: string;
  bottlesPerCase: number;
  shrinkWeightPerCaseKg: string;
  cartonsPerCase: number;
  createdAt: string;
}

export interface BillOfMaterials {
  id: string;
  productId: string;
  stockId: string;
  quantityPerUnit: string;
  createdAt: string;
}

export interface InventoryLedger {
  id: number;
  stockId: string;
  batchId?: string | null;
  userId?: string | null;
  type: InventoryLedgerType;
  quantityChange: string;
  balanceAfter: string;
  remarks?: string | null;
  occurredAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedReason?: string | null;
}

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  stockId: string;
  quantity: string;
  status: StockTransferStatus;
  transferredBy?: string | null;
  receivedBy?: string | null;
  transferredAt: string;
  receivedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── PROCUREMENT (procurement.ts) ─────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  factoryId: string;
  status: PoStatus;
  orderDate: string;
  expectedDelivery?: string | null;
  totalAmount?: string | null;
  createdBy?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  receivedQuantity?: string | null;
  createdAt: string;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  poId?: string | null;
  vendorId: string;
  factoryId: string;
  receivedDate: string;
  status: GrnStatus;
  receivedBy?: string | null;
  invoiceNumber?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  grnId: string;
  poItemId?: string | null;
  description: string;
  quantity: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
  createdAt: string;
}

// ── SALES (sales.ts) ─────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  factoryId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  taxAmount?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  createdBy?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderItem {
  id: string;
  orderId: string;
  productId: string;
  batchId?: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  createdAt: string;
}

export interface SalesPayment {
  id: string;
  orderId: string;
  amount: string;
  paymentDate: string;
  /** CASH | BANK_TRANSFER | CHEQUE */
  paymentMethod: string;
  referenceNumber?: string | null;
  remarks?: string | null;
  createdAt: string;
}

// ── NOTES (notes.ts) ─────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  priority: NotePriority;
  createdById: string;
  /** Cached role slug for hierarchy filtering */
  createdByRole: string;
  departmentId?: string | null;
  lineId?: string | null;
  shiftId?: string | null;
  machineId?: string | null;
  productionBatchId?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  attachments: Array<{ name: string; url: string; type: string; size: number }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ── EXPANDED / JOIN SHAPES (API response helpers) ────────────────────────────

export interface ProductionBatchExpanded extends ProductionBatch {
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
  brand?: Pick<ProductBrand, 'id' | 'name'>;
  line?: Pick<ProductionLine, 'id' | 'name' | 'status'>;
  shift?: Pick<Shift, 'id' | 'name' | 'startTime' | 'endTime'>;
  totals?: BatchTotal;
}

export interface ProductionLogExpanded extends ProductionLog {
  user?: Pick<User, 'id' | 'name' | 'username'>;
}


export interface SalesOrderExpanded extends SalesOrder {
  customer?: Pick<Customer, 'id' | 'name' | 'code'>;
  items?: SalesOrderItem[];
}

export interface InventoryStockExpanded extends InventoryStock {
  warehouse?: Pick<WarehouseLocation, 'id' | 'name' | 'type'>;
}
