import { pgTable, uuid, varchar, text, timestamp, boolean, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { productionLines } from './master-data';

import { productionBatches } from './production';

export const noteTypeEnum = pgEnum('note_type', [
  'GENERAL',
  'PRODUCTION',
  'MAINTENANCE',

  'SHIFT_HANDOVER',
  'INCIDENT',
  'BREAKDOWN',
  'ALERT',
  'STOCK'
]);

export const notePriorityEnum = pgEnum('note_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]);

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  type: noteTypeEnum('type').default('GENERAL').notNull(),
  priority: notePriorityEnum('priority').default('LOW').notNull(),
  
  // Ownership & Hierarchy
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdByRole: varchar('created_by_role', { length: 50 }).notNull(), // cached role slug for hierarchy filtering
  
  // Relations
  departmentId: uuid('department_id'), // can be linked to a department entity if exists, or just a placeholder
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'set null' }),
  
  machineId: varchar('machine_id', { length: 100 }),
  productionBatchId: uuid('production_batch_id').references(() => productionBatches.id, { onDelete: 'set null' }),
  
  // State
  isPinned: boolean('is_pinned').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  
  // Data
  attachments: jsonb('attachments').default([]), // Array of { name, url, type, size }
  tags: jsonb('tags').default([]), // Array of strings
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return [
    index('idx_notes_created_by').on(table.createdById),
    index('idx_notes_type').on(table.type),
    index('idx_notes_priority').on(table.priority),
    index('idx_notes_line').on(table.lineId),
    index('idx_notes_batch').on(table.productionBatchId),
    index('idx_notes_created_at').on(table.createdAt),
  ];
});
