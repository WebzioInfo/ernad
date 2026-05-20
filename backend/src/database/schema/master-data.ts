import { pgTable, uuid, varchar, timestamp, integer, decimal, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const factories = pgTable('factories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 10 }).notNull().unique(), // e.g. 'F1', 'KLA'
  location: varchar('location', { length: 255 }),
  contactInfo: varchar('contact_info', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productionLines = pgTable('production_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'restrict' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  status: varchar('status', { length: 50 }).default('IDLE').notNull(), // IDLE, RUNNING, CHANGEOVER, BREAKDOWN, MAINTENANCE, QUALITY_HOLD, SHIFT_CLOSED
  currentEfficiency: decimal('current_efficiency', { precision: 5, scale: 2 }).default('0'),
  

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_lines_name_factory').on(table.name, table.factoryId),
    index('idx_lines_status').on(table.status),
  ];
});


export const productBrands = pgTable('product_brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 50 }).unique(),
  brandId: uuid('brand_id').references(() => productBrands.id, { onDelete: 'restrict' }),
  category: varchar('category', { length: 50 }), // e.g., 'Water', 'Soda', 'Juice'
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'restrict' }),
  targetBPM: integer('target_bpm').default(120).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
