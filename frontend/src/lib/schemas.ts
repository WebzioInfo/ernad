/**
 * ERNAD MES – ZOD FORM SCHEMAS
 * All constraints mirror database column definitions.
 * varchar(n) → max(n), notNull → required, nullable → optional
 */

import { z } from 'zod';

// ─── BATCH / PRODUCTION ───────────────────────────────────────────────────────

/** POST production/batches/start – aligns with StartBatchDto */
export const startBatchSchema = z.object({
  lineId:         z.string().uuid('Invalid line'),
  brandId:        z.string().uuid('Invalid brand'),
  productId:      z.string().uuid('Invalid product'),
  shiftId:        z.string().uuid('Invalid shift'),
  batchCode:      z.string().max(50).optional(),
  remarks:        z.string().max(500).optional(),
  startTime:      z.string().datetime({ message: 'Invalid start time' }),
  targetQuantity: z.number().int().positive().optional(),
  operatorIds:    z.array(z.string().uuid()).optional(),
});
export type StartBatchForm = z.infer<typeof startBatchSchema>;

/** PATCH production/batches/:id/close */
export const closeBatchSchema = z.object({
  remarks:        z.string().max(500).optional(),
  endTime:        z.string().datetime({ message: 'Invalid end time' }).optional(),
  materialReturn: z.record(z.number()).optional(),
});
export type CloseBatchForm = z.infer<typeof closeBatchSchema>;

/** POST production/batches/:id/reopen */
export const reopenBatchSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});
export type ReopenBatchForm = z.infer<typeof reopenBatchSchema>;

/** POST production/lines/:id/changeover */
export const changeoverSchema = z.object({
  batchId:   z.string().uuid(),
  productId: z.string().uuid('Select a product'),
});
export type ChangeoverForm = z.infer<typeof changeoverSchema>;

// ─── TELEMETRY LOG ────────────────────────────────────────────────────────────

/** POST telemetry/logs – aligns with productionLogs schema */
export const telemetryLogSchema = z.object({
  batchId:                z.string().uuid(),
  lineId:                 z.string().uuid(),
  shiftId:                z.string().uuid(),
  brandId:                z.string().uuid(),
  productId:              z.string().uuid(),
  station:                z.enum(['BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC']),
  primaryCount:           z.number().int().min(0),
  wastageCount:           z.number().int().min(0),
  secondaryPackagingCount: z.number().int().min(0).default(0),
  eventType:              z.enum([
    'POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE',
    'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'DOWNTIME_PAUSE',
  ]).default('NORMAL_PRODUCTION'),
  isRework:               z.boolean().default(false),
  remarks:                z.string().max(500).optional(),
  loggedAt:               z.string().datetime(),
  // Material
  preformUsage:           z.number().int().min(0).optional(),
  capUsage:               z.number().int().min(0).optional(),
  rawMaterialId:          z.string().uuid().optional().nullable(),
  bagsUsed:               z.number().min(0).optional().nullable(),
  bopRollUsage:           z.number().min(0).optional(),
  inkUsage:               z.number().min(0).optional(),
  solventUsage:           z.number().min(0).optional(),
  shrinkWeightUsed:       z.number().min(0).optional(),
  finishedGoodsProduced:  z.number().int().min(0).optional(),
  casesProduced:          z.number().int().min(0).optional(),
  packingTypeId:          z.string().uuid().optional(),
  // QC inline
  phValue:                z.number().min(0).max(14).optional(),
  tdsValue:               z.number().min(0).optional(),
  testResult:             z.enum(['PASSED', 'FAILED', 'PENDING']).optional(),
  selectedStockId:        z.string().uuid().optional(),
});
export type TelemetryLogForm = z.infer<typeof telemetryLogSchema>;

// ─── QUALITY CHECK ────────────────────────────────────────────────────────────

/** POST production/quality-checks – aligns with quality_checks schema */
export const qualityCheckSchema = z.object({
  batchId:     z.string().uuid(),
  inspectorId: z.string().uuid(),
  checkType:   z.string().max(100).min(1, 'Check type required'),
  result:      z.enum(['PASS', 'FAIL']),
  parameters:  z.record(z.any()).default({}),
  remarks:     z.string().max(500).optional(),
});
export type QualityCheckForm = z.infer<typeof qualityCheckSchema>;

// ─── USERS ────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  name:        z.string().min(2).max(150),
  username:    z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Alphanumeric only'),
  email:       z.string().email().max(255),
  phoneNumber: z.string().max(20).optional(),
  department:  z.string().max(100).optional(),
  jobTitle:    z.string().max(100).optional(),
  factoryId:   z.string().uuid().optional(),
  roleIds:     z.array(z.string().uuid()).min(1, 'Assign at least one role'),
});
export type CreateUserForm = z.infer<typeof createUserSchema>;

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export const createStockSchema = z.object({
  factoryId:    z.string().uuid(),
  warehouseId:  z.string().uuid(),
  categoryId:   z.string().uuid().optional(),
  itemName:     z.string().min(1).max(150),
  sku:          z.string().max(100).optional(),
  unit:         z.string().min(1).max(20),
  quantity:     z.number().min(0),
  minimumStock: z.number().min(0),
  valuationRate: z.number().min(0).optional(),
});
export type CreateStockForm = z.infer<typeof createStockSchema>;

// ─── NOTES ────────────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  title:             z.string().min(1).max(255),
  content:           z.string().min(1),
  type:              z.enum(['GENERAL', 'PRODUCTION', 'MAINTENANCE', 'QUALITY',
                              'SHIFT_HANDOVER', 'INCIDENT', 'BREAKDOWN', 'ALERT', 'STOCK']),
  priority:          z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  lineId:            z.string().uuid().optional(),
  shiftId:           z.string().uuid().optional(),
  productionBatchId: z.string().uuid().optional(),
  machineId:         z.string().max(100).optional(),
  isPinned:          z.boolean().default(false),
  isPrivate:         z.boolean().default(false),
  tags:              z.array(z.string()).default([]),
});
export type CreateNoteForm = z.infer<typeof createNoteSchema>;

// ─── BIOMETRIC ────────────────────────────────────────────────────────────────

export const shiftAssignmentSchema = z.object({
  userId:        z.string().uuid(),
  shiftId:       z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
});
export type ShiftAssignmentForm = z.infer<typeof shiftAssignmentSchema>;

// ─── DOWNTIME ─────────────────────────────────────────────────────────────────

export const logDowntimeSchema = z.object({
  batchId:   z.string().uuid(),
  lineId:    z.string().uuid(),
  factoryId: z.string().uuid(),
  station:   z.string().min(1).max(50),
  reason:    z.string().min(1).max(100),
  startTime: z.string().datetime(),
  remarks:   z.string().max(500).optional(),
});
export type LogDowntimeForm = z.infer<typeof logDowntimeSchema>;

// ─── SALES ORDER ──────────────────────────────────────────────────────────────

export const createSalesOrderSchema = z.object({
  customerId:   z.string().uuid(),
  factoryId:    z.string().uuid(),
  orderDate:    z.string().datetime(),
  deliveryDate: z.string().datetime().optional(),
  remarks:      z.string().optional(),
  items: z.array(z.object({
    productId:  z.string().uuid(),
    batchId:    z.string().uuid().optional(),
    quantity:   z.number().int().positive(),
    unitPrice:  z.number().positive(),
  })).min(1, 'Add at least one item'),
});
export type CreateSalesOrderForm = z.infer<typeof createSalesOrderSchema>;

// ─── DISPATCH ────────────────────────────────────────────────────────────────

export const logDispatchSchema = z.object({
  batchId:       z.string().uuid(),
  managerId:     z.string().uuid(),
  destination:   z.string().min(1).max(255),
  quantity:      z.number().int().positive(),
  vehicleNumber: z.string().max(50).optional(),
  remarks:       z.string().max(500).optional(),
});
export type LogDispatchForm = z.infer<typeof logDispatchSchema>;
