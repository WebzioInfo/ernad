import { pgTable, uuid, varchar, timestamp, integer, decimal, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const productionLines = pgTable('production_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  status: varchar('status', { length: 50 }).default('IDLE').notNull(), // IDLE, RUNNING, CHANGEOVER, BREAKDOWN, MAINTENANCE, SHIFT_CLOSED
  currentEfficiency: decimal('current_efficiency', { precision: 5, scale: 2 }).default('0'),
  

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_lines_name').on(table.name),
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
  targetBPM: integer('target_bpm').default(120).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
