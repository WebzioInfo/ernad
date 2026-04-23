import { pgTable, uuid, varchar, timestamp, integer, decimal } from 'drizzle-orm/pg-core';

export const productionLines = pgTable('production_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  status: varchar('status', { length: 50 }).default('IDLE').notNull(), // IDLE, RUNNING, CHANGEOVER, MAINTENANCE
  currentEfficiency: decimal('current_efficiency', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(), // e.g., 'Morning', 'Afternoon', 'Night'
  startTime: varchar('start_time', { length: 5 }).notNull(), // 'HH:mm'
  endTime: varchar('end_time', { length: 5 }).notNull(), // 'HH:mm'
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  brandId: uuid('brand_id').references(() => productBrands.id),
  category: varchar('category', { length: 50 }), // e.g., 'Water', 'Soda', 'Juice'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
