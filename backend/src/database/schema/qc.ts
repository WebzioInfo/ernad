import { pgTable, uuid, varchar, timestamp, decimal, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { productionBatches } from './production';
import { users } from './users';
import { factories } from './master-data';

export const qcStatusEnum = pgEnum('qc_status', ['PENDING', 'PASSED', 'FAILED', 'ON_HOLD', 'RELEASED']);

export const labTests = pgTable('lab_tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'cascade' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'cascade' }).notNull(),
  testerId: uuid('tester_id').references(() => users.id).notNull(),
  
  testType: varchar('test_type', { length: 50 }).default('ROUTINE').notNull(), // ROUTINE, EXTERNAL, R&D
  status: qcStatusEnum('status').default('PENDING').notNull(),
  
  // Chemical/Physical Parameters
  phValue: decimal('ph_value', { precision: 4, scale: 2 }),
  tdsValue: decimal('tds_value', { precision: 8, scale: 2 }),
  turbidity: decimal('turbidity', { precision: 6, scale: 2 }),
  temperature: decimal('temperature', { precision: 5, scale: 2 }),
  
  // Sensory/Organoleptic
  taste: varchar('taste', { length: 50 }),
  odor: varchar('odor', { length: 50 }),
  color: varchar('color', { length: 50 }),
  
  additionalParams: jsonb('additional_params'), // For flexible R&D metrics
  
  remarks: varchar('remarks', { length: 500 }),
  testedAt: timestamp('tested_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),
  deletedReason: varchar('deleted_reason', { length: 500 }),
}, (table) => {
  return [
    index('idx_lab_batch').on(table.batchId),
    index('idx_lab_status').on(table.status),
    index('idx_lab_time').on(table.testedAt),
  ];
});
