import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, uniqueIndex, date, decimal } from 'drizzle-orm/pg-core';
import { users } from './users';

export const biometricDevices = pgTable('biometric_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  ipAddress: varchar('ip_address', { length: 50 }).notNull(),
  port: integer('port').default(4370).notNull(),
  location: varchar('location', { length: 100 }),
  isActive: boolean('is_active').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('OFFLINE').notNull(), // ONLINE, OFFLINE, SYNCING
  lastConnectedAt: timestamp('last_connected_at'),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const biometricAttendanceLogs = pgTable('biometric_attendance_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').references(() => biometricDevices.id, { onDelete: 'cascade' }).notNull(),
  deviceUserId: varchar('device_user_id', { length: 50 }).notNull(), // UserID from biometric device
  punchTime: timestamp('punch_time').notNull(),
  punchType: integer('punch_type').default(0), // 0: Check-In, 1: Check-Out, etc.
  rawData: jsonb('raw_data'),
  source: varchar('source', { length: 50 }).default('ZKLIB').notNull(),
  uniqueHash: varchar('unique_hash', { length: 100 }).notNull(), // unique constraint to prevent duplicates
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_biometric_log_hash').on(table.uniqueHash),
  ];
});

export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: varchar('start_time', { length: 8 }).notNull(), // HH:mm:ss
  endTime: varchar('end_time', { length: 8 }).notNull(),
  graceMinutes: integer('grace_minutes').default(15).notNull(),
  overtimeAfter: integer('overtime_after').default(0), // minutes
  minimumHours: integer('minimum_hours').default(4).notNull(),
  shiftType: varchar('shift_type', { length: 20 }).default('GENERAL').notNull(), // DAY, NIGHT, SPLIT
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const employeeShiftAssignments = pgTable('employee_shift_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'cascade' }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyAttendance = pgTable('daily_attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id),
  checkIn: timestamp('check_in'),
  checkOut: timestamp('check_out'),
  workedHours: decimal('worked_hours', { precision: 5, scale: 2 }),
  status: varchar('status', { length: 20 }).default('PRESENT').notNull(), // PRESENT, LATE, ABSENT, HALF_DAY
  lateMinutes: integer('late_minutes').default(0),
  overtimeMinutes: integer('overtime_minutes').default(0),
  remarks: varchar('remarks', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_daily_attendance_user_date').on(table.userId, table.date),
  ];
});

export const monthlyAttendanceSummaries = pgTable('monthly_attendance_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  totalPresent: integer('total_present').default(0),
  totalAbsent: integer('total_absent').default(0),
  totalHalfDays: integer('total_half_days').default(0),
  totalLates: integer('total_lates').default(0),
  totalOvertimeMinutes: integer('total_overtime_minutes').default(0),
  netPayableDays: decimal('net_payable_days', { precision: 4, scale: 1 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_monthly_summary_user_month').on(table.userId, table.month, table.year),
  ];
});

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  leaveType: varchar('leave_type', { length: 50 }).default('ANNUAL').notNull(),
  reason: varchar('reason', { length: 255 }),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
