import { pgTable, uuid, varchar, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { productionLines } from './master-data';


// ── RBAC SYSTEM (Phase 3 Redesign) ──

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(), // e.g. "Plant Manager"
  slug: varchar('slug', { length: 50 }).notNull().unique(), // e.g. "ADMIN"
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "Edit Users"
  slug: varchar('slug', { length: 100 }).notNull().unique(), // e.g. "user:edit"
  category: varchar('category', { length: 50 }), // e.g. "Personnel", "Production"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
}, (table) => {
  return [
    index('idx_role_permissions').on(table.roleId, table.permissionId),
  ];
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  department: varchar('department', { length: 100 }),
  jobTitle: varchar('job_title', { length: 100 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  pinCode: varchar('pin_code', { length: 255 }),
  operatorType: varchar('operator_type', { length: 50 }), // @deprecated - Use operator_sessions.station
  isActive: boolean('is_active').default(true).notNull(),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return [
    index('idx_users_username').on(table.username),
    index('idx_users_email').on(table.email),
  ];
});

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
}, (table) => {
  return [
    index('idx_user_roles').on(table.userId, table.roleId),
  ];
});

export const userLines = pgTable('user_lines', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id, { onDelete: 'cascade' }).notNull(),
}, (table) => {
  return [
    index('idx_user_lines').on(table.userId, table.lineId),
  ];
});


