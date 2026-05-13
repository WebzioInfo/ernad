import { pgTable, uuid, varchar, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { factories, productionLines } from './master-data';
import { users } from './users';

export const terminalTypeEnum = pgEnum('terminal_type', ['PRODUCTION', 'QC', 'MAINTENANCE', 'SUPERVISOR', 'KIOSK']);
export const terminalStatusEnum = pgEnum('terminal_status', ['OFFLINE', 'ONLINE', 'MAINTENANCE', 'LOCKED']);
export const terminalTrustModeEnum = pgEnum('terminal_trust_mode', ['STRICT_KIOSK', 'FLEXIBLE_AUTH', 'TEMPORARY_SESSION', 'MOBILE_OPERATOR']);

export const terminals = pgTable('terminals', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(), // e.g., T-BLW-01
  name: varchar('name', { length: 100 }).notNull(), // e.g., Blowing Station Tablet
  type: terminalTypeEnum('type').default('PRODUCTION').notNull(),
  
  factoryId: uuid('factory_id').references(() => factories.id).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id), // Can be null for mobile supervisor tablets
  department: varchar('department', { length: 50 }), // BLOWING, FILLING, etc.
  
  deviceId: varchar('device_id', { length: 255 }), // Browser-generated UUID or secure token
  trustMode: terminalTrustModeEnum('trust_mode').default('STRICT_KIOSK').notNull(),
  
  macAddress: varchar('mac_address', { length: 50 }), // @deprecated - Use deviceId
  ipAddress: varchar('ip_address', { length: 50 }),
  
  status: terminalStatusEnum('status').default('OFFLINE').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const terminalSessions = pgTable('terminal_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  terminalId: uuid('terminal_id').references(() => terminals.id).notNull(),
  supervisorId: uuid('supervisor_id').references(() => users.id).notNull(), // The person who authorized the terminal
  
  shiftId: uuid('shift_id').notNull(), // Linked to current operational shift
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  
  isActive: boolean('is_active').default(true).notNull(),
  authMetadata: varchar('auth_metadata', { length: 500 }), // Device fingerprinting
}, (table) => {
  return [
    index('idx_terminal_session_active').on(table.terminalId, table.isActive),
  ];
});
