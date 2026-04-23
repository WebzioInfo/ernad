import { pgTable, uuid, timestamp, integer, decimal, bigserial, index, pgEnum, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { productionBatches } from './production';
import { users } from './users';
import { productionLines, shifts } from './master-data';

export const stationTypeEnum = pgEnum('station_type', ['BLOWING', 'FILLING', 'LABELING', 'PACKING']);

// The Ledger of all production activity (Enterprise Standard)
export const factoryLogs = pgTable('factory_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().unique(), // Idempotency Key
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  station: stationTypeEnum('station').notNull(),
  primaryCount: integer('primary_count').notNull().default(0),
  wastageCount: integer('wastage_count').notNull().default(0),
  loggedAt: timestamp('logged_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_factory_logs_batch').on(table.batchId),
    index('idx_factory_logs_line_shift').on(table.lineId, table.shiftId),
    index('idx_factory_logs_station').on(table.station),
    index('idx_factory_logs_request').on(table.requestId),
  ];
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


export const operatorBlowingLogs = pgTable('operator_blowing_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  preformCount: integer('preform_count').notNull().default(0),
  bagsUsed: integer('bags_used').notNull().default(0),
  damaged: integer('damaged').notNull().default(0),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (table) => {
  return [index('idx_blowing_batch').on(table.batchId)];
});

export const operatorFillingLogs = pgTable('operator_filling_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  bottleCount: integer('bottle_count').notNull().default(0),
  capWastage: integer('cap_wastage').notNull().default(0),
  boxesUsed: integer('boxes_used').notNull().default(0),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (table) => {
  return [index('idx_filling_batch').on(table.batchId)];
});

export const operatorLabelingLogs = pgTable('operator_labeling_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  labelCount: integer('label_count').notNull().default(0),
  inkUsedMl: integer('ink_used_ml').notNull().default(0),
  makeupUsedMl: integer('makeup_used_ml').notNull().default(0),
  cleaningSolutionUsedMl: integer('cleaning_solution_used_ml').notNull().default(0),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (table) => {
  return [index('idx_labeling_batch').on(table.batchId)];
});

export const operatorPackingLogs = pgTable('operator_packing_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  shrinkRollUsedKg: decimal('shrink_roll_used_kg', { precision: 10, scale: 2 }).notNull().default('0'),
  shrinkWastageKg: decimal('shrink_wastage_kg', { precision: 10, scale: 2 }).notNull().default('0'),
  packedCount: integer('packed_count').notNull().default(0),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
}, (table) => {
  return [index('idx_packing_batch').on(table.batchId)];
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: varchar('message', { length: 1000 }).notNull(),
  severity: varchar('severity', { length: 20 }).default('INFO'),
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
