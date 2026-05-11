import { pgTable, uuid, timestamp, pgEnum, index, jsonb, varchar, integer, decimal, bigserial, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { factories, productionLines, productBrands, products } from './master-data';
import { shifts } from './biometric';

export const batchStatusEnum = pgEnum('batch_status', ['PLANNING', 'RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED', 'CLOSED']);

export const productionBatches = pgTable('production_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchCode: varchar('batch_code', { length: 50 }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'restrict' }).notNull(),
  brandId: uuid('brand_id').references(() => productBrands.id, { onDelete: 'restrict' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'restrict' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'restrict' }).notNull(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  status: batchStatusEnum('status').default('RUNNING').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  remarks: varchar('remarks', { length: 500 }),
  materialReturn: jsonb('material_return'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_batches_line_status').on(table.lineId, table.status),
    index('idx_batches_product').on(table.productId),
    uniqueIndex('idx_batches_code_factory').on(table.batchCode, table.factoryId),
    index('idx_batches_factory').on(table.factoryId),
  ];
});

// @deprecated - Use batchTotals for tracking aggregates
export const batchOutputs = pgTable('batch_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  gradeA: integer('grade_a').default(0).notNull(), // Main usable product
  gradeB: integer('grade_b').default(0).notNull(), // Secondary/Discounted
  scrap: integer('scrap').default(0).notNull(), // Waste
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const changeoverLogs = pgTable('changeover_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').notNull(),
  fromProductId: uuid('from_product_id').notNull(),
  toProductId: uuid('to_product_id').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  leftoverMaterials: jsonb('leftover_materials').notNull(),
  wastedMaterials: jsonb('wasted_materials').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_changeover_batch').on(table.batchId),
    index('idx_changeover_line').on(table.lineId),
  ];
});

// @deprecated - Material state is now tracked via materialFlows
export const batchSnapshots = pgTable('batch_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  snapshotType: varchar('snapshot_type', { length: 50 }).notNull(), // 'CHANGEOVER_START', 'CHANGEOVER_END', 'SHIFT_END'
  data: jsonb('data').notNull(), // Full material state { "Preforms": 500, ... }
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_snapshots_batch').on(table.batchId),
  ];
});

export const materialFlows = pgTable('material_flows', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  materialName: varchar('material_name', { length: 100 }).notNull(),
  issued: integer('issued').notNull().default(0),
  used: integer('used').notNull().default(0),
  wasted: integer('wasted').notNull().default(0),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_material_flows_batch').on(table.batchId),
  ];
});

export const operatorSessions = pgTable('operator_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id).notNull(),
  batchId: uuid('batch_id').references(() => productionBatches.id), // Bind to batch
  station: varchar('station_type', { length: 50 }).notNull(), // BLOWING, FILLING, LABELING, PACKING
  shiftId: uuid('shift_id').references(() => shifts.id),
  factoryId: uuid('factory_id').references(() => factories.id), // Consolidated from sessions.ts
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  isActive: boolean('is_active').default(true).notNull(),
  endedBy: uuid('ended_by').references(() => users.id),
  endReason: varchar('end_reason', { length: 100 }), // manual, timeout, forced, batch_closed
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_operator_sessions_user').on(table.userId, table.isActive),
    index('idx_operator_sessions_line').on(table.lineId, table.isActive),
    index('idx_operator_sessions_batch').on(table.batchId),
  ];
});

export const downtimeLogs = pgTable('downtime_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  station: varchar('station', { length: 50 }).notNull(), // BLOWING, FILLING, etc.
  reason: varchar('reason', { length: 100 }).notNull(), // POWER_FAILURE, MACHINE_BREAKDOWN, etc.
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  durationMinutes: integer('duration_minutes'),
  remarks: varchar('remarks', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_downtime_batch').on(table.batchId),
    index('idx_downtime_line').on(table.lineId),
    index('idx_downtime_active').on(table.batchId, table.endTime),
  ];
});
