import { pgTable, uuid, varchar, timestamp, integer, boolean, decimal, jsonb, bigserial, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const batchStatusEnum = pgEnum('batch_status', ['RUNNING', 'CHANGEOVER', 'CLOSED']);
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FILLING_OPERATOR', 'BLOWING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR', 'OPERATOR']);

export const operators = pgTable('operators', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(), // Supports PIN or hash
    role: userRoleEnum('role').default('OPERATOR').notNull(),
    operatorType: varchar('operator_type', { length: 50 }), // blowing, filling, labeling, packing
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

// Core Entities
export const productionBatches = pgTable('production_batches', {
    id: uuid('id').defaultRandom().primaryKey(),
    lineId: uuid('line_id'),
    brandId: uuid('brand_id'),
    productId: uuid('product_id'),
    shiftId: uuid('shift_id'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    status: batchStatusEnum('status').default('RUNNING'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const changeoverLogs = pgTable('changeover_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    lineId: uuid('line_id'),
    fromProductId: uuid('from_product_id'),
    toProductId: uuid('to_product_id'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    leftoverMaterials: jsonb('leftover_materials').notNull(),
    wastedMaterials: jsonb('wasted_materials').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
});

// Operator Logs
export const operatorBlowingLogs = pgTable('operator_blowing_logs', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id'),
    preformCount: integer('preform_count').notNull().default(0),
    bagsUsed: integer('bags_used').notNull().default(0),
    damaged: integer('damaged').notNull().default(0),
    loggedAt: timestamp('logged_at').defaultNow(),
});

export const operatorFillingLogs = pgTable('operator_filling_logs', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id'),
    bottleCount: integer('bottle_count').notNull().default(0),
    capWastage: integer('cap_wastage').notNull().default(0),
    boxesUsed: integer('boxes_used').notNull().default(0),
    loggedAt: timestamp('logged_at').defaultNow(),
});

export const operatorLabelingLogs = pgTable('operator_labeling_logs', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id'),
    labelCount: integer('label_count').notNull().default(0),
    inkUsedMl: integer('ink_used_ml').notNull().default(0),
    makeupUsedMl: integer('makeup_used_ml').notNull().default(0),
    cleaningSolutionUsedMl: integer('cleaning_solution_used_ml').notNull().default(0),
    loggedAt: timestamp('logged_at').defaultNow(),
});

export const operatorPackingLogs = pgTable('operator_packing_logs', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    operatorId: uuid('operator_id'),
    shrinkRollUsedKg: decimal('shrink_roll_used_kg', { precision: 10, scale: 2 }).notNull().default('0'),
    shrinkWastageKg: decimal('shrink_wastage_kg', { precision: 10, scale: 2 }).notNull().default('0'),
    packedCount: integer('packed_count').notNull().default(0),
    loggedAt: timestamp('logged_at').defaultNow(),
});

// Material Flows
export const materialFlows = pgTable('material_flows', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }),
    materialName: varchar('material_name', { length: 100 }).notNull(),
    issued: integer('issued').notNull().default(0),
    used: integer('used').notNull().default(0),
    wasted: integer('wasted').notNull().default(0),
    // remaining is calculated via a stored generated column in Postgres, 
    // we don't define the generated SQL purely in Drizzle for inserts, Drizzle just reads it.
    loggedAt: timestamp('logged_at').defaultNow(),
});
