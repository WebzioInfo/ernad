import { pgTable, uuid, timestamp, pgEnum, index, jsonb, varchar, integer, decimal, bigserial, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { factories, productionLines, productBrands, products, shifts } from './master-data';

export const batchStatusEnum = pgEnum('batch_status', ['PLANNING', 'RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED', 'CLOSED']);

export const productionBatches = pgTable('production_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchCode: varchar('batch_code', { length: 50 }),
  productionDate: timestamp('production_date'),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => productBrands.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  status: batchStatusEnum('status').default('RUNNING').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  remarks: varchar('remarks', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_batches_line_status').on(table.lineId, table.status),
    index('idx_batches_product').on(table.productId),
    uniqueIndex('idx_batches_code_line').on(table.batchCode, table.lineId),
  ];
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
