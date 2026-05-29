import { pgTable, uuid, timestamp, integer, varchar, text, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { productionLines } from './master-data';
import { downtimeLogs } from './production';

export const incidentCategoryEnum = pgEnum('incident_category', ['FACTORY', 'LINE', 'STATION']);
export const incidentPriorityEnum = pgEnum('incident_priority', ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export const incidentStatusEnum = pgEnum('incident_status', ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const incidentTypes = pgTable('incident_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  category: incidentCategoryEnum('category').notNull(),
  priority: incidentPriorityEnum('priority').default('MEDIUM').notNull(),
  selfResolvable: boolean('self_resolvable').default(false).notNull(),
  productionImpact: boolean('production_impact').default(true).notNull(),
  defaultSlaMinutes: integer('default_sla_minutes').default(60).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_incident_types_category').on(table.category),
  index('idx_incident_types_active').on(table.isActive),
]);

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  incidentNumber: varchar('incident_number', { length: 40 }).notNull().unique(),
  title: varchar('title', { length: 180 }).notNull(),
  description: text('description'),
  category: incidentCategoryEnum('category').notNull(),
  factoryId: varchar('factory_id', { length: 80 }).default('ERN-KL01'),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'set null' }),
  stationId: varchar('station_id', { length: 50 }),
  incidentTypeId: uuid('incident_type_id').references(() => incidentTypes.id, { onDelete: 'restrict' }).notNull(),
  priority: incidentPriorityEnum('priority').notNull(),
  status: incidentStatusEnum('status').default('OPEN').notNull(),
  reportedBy: uuid('reported_by').references(() => users.id, { onDelete: 'set null' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  closedAt: timestamp('closed_at'),
  durationMinutes: integer('duration_minutes'),
  productionImpact: boolean('production_impact').default(true).notNull(),
  downtimeLogId: uuid('downtime_log_id').references(() => downtimeLogs.id, { onDelete: 'set null' }),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  preventiveAction: text('preventive_action'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  index('idx_incidents_status').on(table.status),
  index('idx_incidents_priority').on(table.priority),
  index('idx_incidents_line_station').on(table.lineId, table.stationId),
  index('idx_incidents_reported_by').on(table.reportedBy),
  index('idx_incidents_opened_at').on(table.openedAt),
  index('idx_incidents_deleted').on(table.deletedAt),
]);

export const incidentComments = pgTable('incident_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_incident_comments_incident').on(table.incidentId),
]);

export const incidentAttachments = pgTable('incident_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  kind: varchar('kind', { length: 30 }).default('EVIDENCE').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: varchar('file_name', { length: 255 }),
  mimeType: varchar('mime_type', { length: 120 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_incident_attachments_incident').on(table.incidentId),
]);

export const incidentAssignments = pgTable('incident_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }).notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  remarks: text('remarks'),
}, (table) => [
  index('idx_incident_assignments_incident').on(table.incidentId),
]);

export const incidentHistory = pgTable('incident_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }).notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 80 }).notNull(),
  fromStatus: incidentStatusEnum('from_status'),
  toStatus: incidentStatusEnum('to_status'),
  payload: jsonb('payload'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
}, (table) => [
  index('idx_incident_history_incident').on(table.incidentId),
  index('idx_incident_history_time').on(table.occurredAt),
]);
