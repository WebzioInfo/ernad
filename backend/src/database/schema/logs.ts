import { pgTable, uuid, timestamp, integer, decimal, bigserial, index, pgEnum, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { productionBatches, operatorSessions } from './production';
import { users } from './users';
import { factories, productionLines, productBrands, products } from './master-data';
import { shifts } from './biometric';

export const stationTypeEnum = pgEnum('station_type', ['BLOWING', 'FILLING', 'LABELING', 'PACKING']);
export const eventTypeEnum = pgEnum('event_type', ['POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'DOWNTIME_PAUSE']);

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
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  station: stationTypeEnum('station').notNull(),
  
  // Data Normalization (Phase 1)
  primaryCount: integer('primary_count').notNull().default(0),
  splitValues: jsonb('split_values').$type<number[]>().default([]), // Handle 35785 + 30
  wastageCount: integer('wastage_count').notNull().default(0),
  
  // Event System (Phase 7)
  eventType: eventTypeEnum('event_type').default('NORMAL_PRODUCTION').notNull(),
  isRework: boolean('is_rework').default(false).notNull(), // New: Handle rework logic
  remarks: varchar('remarks', { length: 500 }),

  // Material Consumption Analytics (Enterprise Upgrade)
  capUsage: integer('cap_usage').default(0),
  capRejection: integer('cap_rejection').default(0),
  preformUsage: integer('preform_usage').default(0),
  preformRejection: integer('preform_rejection').default(0),
  bopRollUsage: decimal('bop_roll_usage', { precision: 8, scale: 2 }).default('0'),
  bopRejection: decimal('bop_rejection', { precision: 8, scale: 2 }).default('0'),
  shrinkWeightUsed: decimal('shrink_weight_used', { precision: 8, scale: 2 }).default('0'),
  shrinkWeightRejected: decimal('shrink_weight_rejected', { precision: 8, scale: 2 }).default('0'),
  casesProduced: integer('cases_produced').default(0),
  packingTypeId: uuid('packing_type_id'), // Relates to packaging_configurations
  finishedGoodsProduced: integer('finished_goods_produced').default(0),
  materialCost: decimal('material_cost', { precision: 12, scale: 2 }).default('0'),
  boxCount: integer('box_count').default(0),
  
  loggedAt: timestamp('logged_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_production_logs_batch').on(table.batchId),
    index('idx_production_logs_brand_product').on(table.brandId, table.productId),
    index('idx_production_logs_line_shift').on(table.lineId, table.shiftId, table.brandId, table.productId),
    index('idx_production_logs_station').on(table.station),
    index('idx_production_logs_request').on(table.requestId),
    index('idx_production_logs_date').on(table.loggedAt),
    index('idx_production_logs_session').on(table.sessionId),
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
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  blowingTotal: integer('blowing_total').default(0).notNull(),
  fillingTotal: integer('filling_total').default(0).notNull(),
  labelingTotal: integer('labeling_total').default(0).notNull(),
  packingTotal: integer('packing_total').default(0).notNull(),
  scrapTotal: integer('scrap_total').default(0).notNull(), // New: Tracking waste/rejects
  
  // Material Totals (Enterprise Upgrade)
  capTotal: integer('cap_total').default(0).notNull(),
  preformTotal: integer('preform_total').default(0).notNull(),
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
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(), // OneSignal Subscription ID
  platform: varchar('platform', { length: 20 }).notNull(), // 'web', 'android', 'ios'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── NEW PRODUCTION MODULES (Phase 2 Redesign) ──

export const qualityChecks = pgTable('quality_checks', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  inspectorId: uuid('inspector_id').references(() => users.id).notNull(),
  checkType: varchar('check_type', { length: 100 }).notNull(), // e.g., 'Bottle Integrity', 'PH Level'
  result: varchar('result', { length: 20 }).notNull(), // 'PASS', 'FAIL'
  parameters: jsonb('parameters').notNull(), // e.g., { "ph": 7.2, "weight": "500g" }
  reportUrl: varchar('report_url', { length: 255 }),
  remarks: varchar('remarks', { length: 500 }),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

export const packagingLogs = pgTable('packaging_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  operatorId: uuid('operator_id').references(() => users.id).notNull(),
  packType: varchar('pack_type', { length: 50 }).notNull(), // e.g., 'Crate', 'Box'
  quantity: integer('quantity').notNull(),
  unitsPerPack: integer('units_per_pack').notNull(),
  remarks: varchar('remarks', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_packaging_batch').on(table.batchId),
    index('idx_packaging_factory').on(table.factoryId),
  ];
});

export const dispatchLogs = pgTable('dispatch_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  dispatchManagerId: uuid('dispatch_manager_id').references(() => users.id).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  vehicleNumber: varchar('vehicle_number', { length: 50 }),
  remarks: varchar('remarks', { length: 500 }),
  dispatchedAt: timestamp('dispatched_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_dispatch_batch').on(table.batchId),
    index('idx_dispatch_factory').on(table.factoryId),
  ];
});



