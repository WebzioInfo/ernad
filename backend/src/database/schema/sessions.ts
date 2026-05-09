import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { factories, productionLines } from './master-data';
import { shifts } from './biometric';

export const operatorSessions = pgTable('operator_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  lineId: uuid('line_id').references(() => productionLines.id).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id).notNull(),
  loginTime: timestamp('login_time').defaultNow().notNull(),
  logoutTime: timestamp('logout_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_active').on(table.userId, table.logoutTime),
  ];
});
