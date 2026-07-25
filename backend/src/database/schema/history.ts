import { pgTable, uuid, varchar, text, timestamp, bigserial, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const recordEditHistory = pgTable('record_edit_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id'),
  module: varchar('module', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: varchar('record_id', { length: 150 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  editedByUserId: uuid('edited_by_user_id').references(() => users.id),
  editedByName: varchar('edited_by_name', { length: 255 }),
  editedByRole: varchar('edited_by_role', { length: 100 }),
  editedAt: timestamp('edited_at').defaultNow().notNull(),
  reason: text('reason'),
  ipAddress: varchar('ip_address', { length: 100 }),
  userAgent: text('user_agent'),
  sessionId: varchar('session_id', { length: 150 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_edit_history_module').on(table.module),
  index('idx_edit_history_table_name').on(table.tableName),
  index('idx_edit_history_record_id').on(table.recordId),
  index('idx_edit_history_edited_by').on(table.editedByUserId),
  index('idx_edit_history_edited_at').on(table.editedAt),
]);
