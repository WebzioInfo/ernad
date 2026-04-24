import { pgTable, uuid, timestamp, integer, decimal, bigserial, index, pgEnum, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { productionBatches } from './production';
import { users } from './users';
import { productionLines, shifts, productBrands, products } from './master-data';

export const stationTypeEnum = pgEnum('station_type', ['BLOWING', 'FILLING', 'LABELING', 'PACKING']);
export const eventTypeEnum = pgEnum('event_type', ['POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END']);

// The Ledger of all production activity (Enterprise Standard)
export const factoryLogs = pgTable('factory_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().unique(), // Idempotency Key
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id).notNull(),
  brandId: uuid('brand_id').references(() => productBrands.id).notNull(), // New: Analytics Pivot
  productId: uuid('product_id').references(() => products.id).notNull(), // New: Analytics Pivot
  userId: uuid('user_id').references(() => users.id).notNull(),
  station: stationTypeEnum('station').notNull(),
  
  // Data Normalization (Phase 1)
  primaryCount: integer('primary_count').notNull().default(0),
  splitValues: jsonb('split_values').$type<number[]>().default([]), // Handle 35785 + 30
  wastageCount: integer('wastage_count').notNull().default(0),
  
  // Event System (Phase 7)
  eventType: eventTypeEnum('event_type').default('NORMAL_PRODUCTION').notNull(),
  isRework: boolean('is_rework').default(false).notNull(), // New: Handle rework logic
  remarks: varchar('remarks', { length: 500 }),
  
  loggedAt: timestamp('logged_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_factory_logs_batch').on(table.batchId),
    index('idx_factory_logs_brand_product').on(table.brandId, table.productId),
    index('idx_factory_logs_line_shift').on(table.lineId, table.shiftId, table.brandId, table.productId),
    index('idx_factory_logs_station').on(table.station),
    index('idx_factory_logs_request').on(table.requestId),
  ];
});

// Separate Material Tracking Module (Phase 2)
export const materialsUsage = pgTable('materials_usage', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  logId: bigserial('log_id', { mode: 'number' }).references(() => factoryLogs.id, { onDelete: 'cascade' }),
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
  lineId: uuid('line_id').references(() => productionLines.id).notNull(),
  blowingTotal: integer('blowing_total').default(0).notNull(),
  fillingTotal: integer('filling_total').default(0).notNull(),
  labelingTotal: integer('labeling_total').default(0).notNull(),
  packingTotal: integer('packing_total').default(0).notNull(),
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



