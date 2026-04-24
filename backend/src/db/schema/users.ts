import { pgTable, uuid, varchar, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN', 
  'ADMIN', 
  'MANAGER', 
  'FILLING_OPERATOR', 
  'BLOWING_OPERATOR', 
  'LABELING_OPERATOR', 
  'PACKING_OPERATOR', 
  'OPERATOR'
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  department: varchar('department', { length: 100 }),
  jobTitle: varchar('job_title', { length: 100 }),
  passwordHash: varchar('password_hash', { length: 255 }), // Nullable for purely PIN-based operators if needed
  pinCode: varchar('pin_code', { length: 255 }),          // Nullable for non-operators
  role: userRoleEnum('role').default('OPERATOR').notNull(),
  operatorType: varchar('operator_type', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return [
    index('idx_users_username').on(table.username),
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ];
});

export const attendanceLogs = pgTable('attendance_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  clockIn: timestamp('clock_in').defaultNow().notNull(),
  clockOut: timestamp('clock_out'),
  shiftName: varchar('shift_name', { length: 50 }), // e.g., Morning, Night
  status: varchar('status', { length: 20 }).default('PRESENT').notNull(), // PRESENT, LATE, ON_LEAVE
  externalSyncId: varchar('external_sync_id', { length: 255 }), // ID from biometric device
  remarks: varchar('remarks', { length: 255 }),
}, (table) => {
  return [
    index('idx_attendance_user_date').on(table.userId, table.clockIn),
    index('idx_attendance_sync_id').on(table.externalSyncId),
  ];
});
