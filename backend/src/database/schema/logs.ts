import { pgTable, uuid, timestamp, integer, decimal, bigserial, index, pgEnum, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { productionBatches, operatorSessions } from './production';
import { users } from './users';
import { productionLines, productBrands, products, shifts } from './master-data';
import { sql } from 'drizzle-orm';
import { rawMaterials } from './inventory';

export const stationTypeEnum = pgEnum('station_type', ['BLOWING', 'FILLING', 'LABELING', 'PACKING']);
export const eventTypeEnum = pgEnum('event_type', ['POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'DOWNTIME_PAUSE']);
export const logStatusEnum = pgEnum('log_status', ['DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CORRECTED', 'OVERRIDDEN']);

// The Ledger of all production activity (Enterprise Standard)
export const productionLogs = pgTable('production_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().unique(), // Idempotency Key
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => productBrands.id, { onDelete: 'cascade' }).notNull(), // New: Analytics Pivot
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(), // New: Analytics Pivot
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').references(() => operatorSessions.id),
  station: stationTypeEnum('station').notNull(),
  
  // Data Normalization (Phase 1)
  primaryCount: integer('primary_count').notNull().default(0),
  splitValues: jsonb('split_values').$type<number[]>().default([]), // Handle 35785 + 30
  wastageCount: decimal('wastage_count', { precision: 12, scale: 4 }).notNull().default('0'),
  bottleLeakage: integer('bottle_leakage').default(0),
  capWastage: integer('cap_wastage').default(0),
  
  // Event System (Phase 7)
  eventType: eventTypeEnum('event_type').default('NORMAL_PRODUCTION').notNull(),
  isRework: boolean('is_rework').default(false).notNull(), // New: Handle rework logic
  status: logStatusEnum('status').default('SUBMITTED').notNull(),
  remarks: varchar('remarks', { length: 500 }),
  
  // Verification Context
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  verificationReason: varchar('verification_reason', { length: 500 }),
  
  rejectedBy: uuid('rejected_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: varchar('rejection_reason', { length: 500 }),

  // Material Consumption Analytics (Enterprise Upgrade)
  capUsage: integer('cap_usage').default(0),
  capBoxUsage: integer('cap_box_usage').default(0),
  preformUsage: integer('preform_usage').default(0),
  rawMaterialId: uuid('raw_material_id').references(() => rawMaterials.id),
  bagsUsed: decimal('bags_used', { precision: 8, scale: 2 }).default('0'),
  bopRollUsage: decimal('bop_roll_usage', { precision: 8, scale: 2 }).default('0'),
  shrinkWeightUsed: decimal('shrink_weight_used', { precision: 8, scale: 2 }).default('0'),
  inkUsage: decimal('ink_usage', { precision: 8, scale: 2 }).default('0'),
  solventUsage: decimal('solvent_usage', { precision: 8, scale: 2 }).default('0'),
  labelUsage: integer('label_usage').default(0), // Normalized from bopRollUsage
  casesProduced: integer('cases_produced').default(0),
  packingTypeId: uuid('packing_type_id'), // Relates to packaging_configurations
  finishedGoodsProduced: integer('finished_goods_produced').default(0),
  materialCost: decimal('material_cost', { precision: 12, scale: 2 }).default('0'),
  boxCount: integer('box_count').default(0),
  secondaryPackagingCount: integer('secondary_packaging_count').default(0).notNull(), // New: Tracking bags/boxes explicitly

  // Packing Station Specifics
  shrinkWasteWeight: decimal('shrink_waste_weight', { precision: 8, scale: 2 }),
  shrinkWastageKg: decimal('shrink_wastage_kg', { precision: 8, scale: 2 }).default('0').notNull(),
  selectedShrinks: jsonb('selected_shrinks').$type<Array<{ shrinkId: string, shrinkName: string, mmUsed: number, wastageKg?: number }>>().default([]).notNull(),
  sourceBatchNumber: varchar('source_batch_number', { length: 100 }),

  // Label Station Specifics
  labelStickerWeight: decimal('label_sticker_weight', { precision: 10, scale: 2 }),
  damagedLabelWeight: decimal('damaged_label_weight', { precision: 10, scale: 2 }),
  inkChanged: boolean('ink_changed').default(false),
  inkUsageMl: decimal('ink_usage_ml', { precision: 8, scale: 2 }),
  makeupChanged: boolean('makeup_changed').default(false),
  makeupUsageQty: integer('makeup_usage_qty').default(0),
  glueUsageKg: decimal('glue_usage_kg', { precision: 10, scale: 3 }),
  rollsUsed: integer('rolls_used').default(0),


  
  loggedAt: timestamp('logged_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at'),
  
  // Historical Snapshot Columns (Enterprise Ledger)
  stockBalanceAfter: decimal('stock_balance_after', { precision: 12, scale: 2 }),
  producedBalanceAfter: decimal('produced_balance_after', { precision: 12, scale: 2 }),
  dispatchedBalanceAfter: decimal('dispatched_balance_after', { precision: 12, scale: 2 }),

  // Forensic Auditability (Phase 8 Hardening)
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),
  deletedReason: varchar('deleted_reason', { length: 500 }),
}, (table) => {
  return [
    index('idx_production_logs_batch').on(table.batchId),
    index('idx_production_logs_brand_product').on(table.brandId, table.productId),
    index('idx_production_logs_line_shift').on(table.lineId, table.shiftId, table.brandId, table.productId),
    index('idx_production_logs_station').on(table.station),
    index('idx_production_logs_request').on(table.requestId),
    index('idx_production_logs_date').on(table.loggedAt),
    index('idx_production_logs_session').on(table.sessionId),
    index('idx_production_logs_deleted').on(table.deletedAt),
    index('idx_production_logs_status').on(table.status),
  ];
});

// Separate Material Tracking Module (Phase 2)
export const materialsUsage = pgTable('materials_usage', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  logId: bigserial('log_id', { mode: 'number' }).references(() => productionLogs.id, { onDelete: 'cascade' }),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  materialName: varchar('material_name', { length: 100 }).notNull(), // Preforms, Caps, Labels, Shrink Roll
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(), // Pcs, Bags, Kg, Ml
  waste: decimal('waste', { precision: 12, scale: 4 }).default('0'),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
});

// Running totals table for high-speed flow validation (Atomic Tracker)
export const batchTotals = pgTable('batch_totals', {
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).primaryKey(),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'cascade' }).notNull(),
  blowingTotal: integer('blowing_total').default(0).notNull(),
  fillingTotal: integer('filling_total').default(0).notNull(),
  labelingTotal: integer('labeling_total').default(0).notNull(),
  packingTotal: integer('packing_total').default(0).notNull(),
  scrapTotal: decimal('scrap_total', { precision: 12, scale: 4 }).default('0').notNull(), // New: Tracking waste/rejects
  
  // Material Totals (Enterprise Upgrade)
  capTotal: integer('cap_total').default(0).notNull(),
  preformTotal: integer('preform_total').default(0).notNull(),
  bagsTotal: decimal('bags_total', { precision: 10, scale: 2 }).default('0').notNull(),
  bopRollTotal: decimal('bop_roll_total', { precision: 10, scale: 2 }).default('0').notNull(),
  shrinkWeightTotal: decimal('shrink_weight_total', { precision: 10, scale: 2 }).default('0').notNull(),
  finishedGoodsTotal: integer('finished_goods_total').default(0).notNull(),
  casesTotal: integer('cases_total').default(0).notNull(),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


// Audit log for administrative actions
export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorId: uuid('actor_id').references(() => users.id),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: varchar('entity_id', { length: 100 }),
  category: varchar('category', { length: 50 }).notNull().default('GENERAL'), // AUTH, PRODUCTION, TELEMETRY, INVENTORY, QC, SALES, SECURITY
  requestId: uuid('request_id').default(sql`NULL`), // For cross-referencing with production_logs
  payload: jsonb('payload'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
});

// Notifications system
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // LOW_EFFICIENCY, HIGH_REJECTION, MACHINE_ISSUE, BATCH_MILESTONE
  title: varchar('title', { length: 255 }).notNull(),
  message: varchar('message', { length: 1000 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('INFO'), // INFO, WARNING, CRITICAL
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_notifications_unread').on(table.isRead, table.createdAt),
  ];
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(), // OneSignal Subscription ID
  platform: varchar('platform', { length: 20 }).notNull(), // 'web', 'android', 'ios'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── NEW PRODUCTION MODULES (Phase 2 Redesign) ──



export const packagingLogs = pgTable('packaging_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  operatorId: uuid('operator_id').references(() => users.id).notNull(),
  packType: varchar('pack_type', { length: 50 }).notNull(), // e.g., 'Crate', 'Box'
  quantity: integer('quantity').notNull(),
  unitsPerPack: integer('units_per_pack').notNull(),
  remarks: varchar('remarks', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_packaging_batch').on(table.batchId),
  ];
});

export const dispatchLogs = pgTable('dispatch_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  dispatchManagerId: uuid('dispatch_manager_id').references(() => users.id).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  vehicleNumber: varchar('vehicle_number', { length: 50 }),
  remarks: varchar('remarks', { length: 500 }),

  // Historical Snapshot Columns (Enterprise Ledger)
  stockBalanceAfter: decimal('stock_balance_after', { precision: 12, scale: 2 }),
  producedBalanceAfter: decimal('produced_balance_after', { precision: 12, scale: 2 }),
  dispatchedBalanceAfter: decimal('dispatched_balance_after', { precision: 12, scale: 2 }),

  dispatchedAt: timestamp('dispatched_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_dispatch_batch').on(table.batchId),
  ];
});



