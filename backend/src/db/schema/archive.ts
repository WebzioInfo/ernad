import { pgTable, uuid, timestamp, varchar, integer, decimal, jsonb, boolean, bigserial, index } from 'drizzle-orm/pg-core';

// Mirrored tables for long-term storage (No FK constraints to live tables to allow decoupling)

export const productionBatchesArchive = pgTable('production_batches_archive', {
  id: uuid('id').primaryKey(),
  batchCode: varchar('batch_code', { length: 50 }).notNull(),
  lineId: uuid('line_id').notNull(),
  productId: uuid('product_id').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  status: varchar('status', { length: 50 }).notNull(),
  archivedAt: timestamp('archived_at').defaultNow().notNull(),
  originalData: jsonb('original_data').notNull(), // Store full row as JSON for safety
}, (table) => [
  index('idx_archive_batch_code').on(table.batchCode),
  index('idx_archive_batch_date').on(table.startTime),
]);

export const productionLogsArchive = pgTable('production_logs_archive', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  batchId: uuid('batch_id').notNull(),
  lineId: uuid('line_id').notNull(),
  station: varchar('station', { length: 50 }).notNull(),
  primaryCount: integer('primary_count').notNull(),
  loggedAt: timestamp('logged_at').notNull(),
  archivedAt: timestamp('archived_at').defaultNow().notNull(),
  originalData: jsonb('original_data').notNull(),
}, (table) => [
  index('idx_archive_logs_batch').on(table.batchId),
  index('idx_archive_logs_date').on(table.loggedAt),
]);

export const operatorSessionsArchive = pgTable('operator_sessions_archive', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  lineId: uuid('line_id').notNull(),
  station: varchar('station', { length: 50 }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  archivedAt: timestamp('archived_at').defaultNow().notNull(),
  originalData: jsonb('original_data').notNull(),
}, (table) => [
  index('idx_archive_sessions_user').on(table.userId),
]);

// Generic archive metadata log
export const dataLifecycleLogs = pgTable('data_lifecycle_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: varchar('action', { length: 50 }).notNull(), // ARCHIVE, VERIFY, DELETE
  entityType: varchar('entity_type', { length: 50 }).notNull(), // BATCH
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // SUCCESS, FAILED
  rowCount: integer('row_count').default(0),
  details: jsonb('details'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
});
