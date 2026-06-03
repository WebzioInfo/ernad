import { pgTable, uuid, varchar, timestamp, integer, boolean, decimal, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { products } from './master-data';
import { users } from './users';


export const rawMaterials = pgTable('raw_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  materialType: varchar('material_type', { length: 50 }).notNull(), // PREFORM, CAP, LABEL, SHRINK, OTHER
  unit: varchar('unit', { length: 50 }).notNull(), // BAG, BOX, PIECE, ROLL
  currentStock: decimal('current_stock', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const warehouseLocations = pgTable('warehouse_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull().default('RAW_MATERIAL'), // RAW_MATERIAL, FINISHED_GOODS, QUARANTINE
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supplierBatches = pgTable('supplier_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
});

export const inventoryStock = pgTable('inventory_stock', {
  id: uuid('id').defaultRandom().primaryKey(),
  warehouseId: uuid('warehouse_id').references(() => warehouseLocations.id, { onDelete: 'restrict' }).notNull(),
  materialType: varchar('material_type', { length: 50 }),
  itemName: varchar('item_name', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 100 }),
  unit: varchar('unit', { length: 20 }).notNull(), // Kg, Rolls, Bags, Boxes, Pcs
  quantity: decimal('quantity', { precision: 12, scale: 2 }).default('0').notNull(),
  minimumStock: decimal('minimum_stock', { precision: 12, scale: 2 }).default('0').notNull(),
  valuationRate: decimal('valuation_rate', { precision: 12, scale: 2 }).default('0'), // For materialCost analytics
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    uniqueIndex('idx_inventory_sku').on(table.sku),
  ];
});

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  stockId: uuid('stock_id').references(() => inventoryStock.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // IN, OUT, ADJUSTMENT, REJECTION, CONSUMPTION
  quantityChange: decimal('quantity_change', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }).notNull(),
  referenceId: varchar('reference_id', { length: 150 }), // Telemetry Log ID, PO Number, etc
  remarks: text('remarks'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const finishedGoodsInventory = pgTable('finished_goods_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }).notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouseLocations.id, { onDelete: 'restrict' }).notNull(),
  status: varchar('status', { length: 50 }).default('AVAILABLE').notNull(), // AVAILABLE, QUARANTINED, DISPATCHED
  quantity: integer('quantity').default(0).notNull(), // Count of cases or bottles
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const packagingConfigurations = pgTable('packaging_configurations', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(), // e.g. "24 Bottle Case"
  bottlesPerCase: integer('bottles_per_case').notNull(),
  shrinkWeightPerCaseKg: decimal('shrink_weight_per_case_kg', { precision: 6, scale: 4 }).notNull(), // e.g. 0.0150 kg
  cartonsPerCase: integer('cartons_per_case').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const billOfMaterials = pgTable('bill_of_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  stockId: uuid('stock_id').references(() => inventoryStock.id, { onDelete: 'cascade' }).notNull(),
  quantityPerUnit: decimal('quantity_per_unit', { precision: 12, scale: 6 }).notNull(), // e.g. 1 Bottle = 1 Preform, 1 Cap, 0.0001 Roll of labels
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

import { productionBatches } from './production';
import { bigserial, index } from 'drizzle-orm/pg-core';

export const inventoryLedger = pgTable('inventory_ledger', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  stockId: uuid('stock_id').references(() => inventoryStock.id, { onDelete: 'cascade' }).notNull(),
  batchId: uuid('batch_id').references(() => productionBatches.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  type: varchar('type', { length: 50 }).notNull(), // INWARD, ISSUE, CONSUMPTION, WASTAGE, ADJUSTMENT, RETURN, PRODUCTION_OUTPUT, DISPATCH
  quantityChange: decimal('quantity_change', { precision: 12, scale: 4 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 4 }).notNull(),

  remarks: varchar('remarks', { length: 255 }),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),
  deletedReason: varchar('deleted_reason', { length: 500 }),
}, (table) => {
  return [
    index('idx_ledger_stock').on(table.stockId),
    index('idx_ledger_batch').on(table.batchId),
    index('idx_ledger_time').on(table.occurredAt),
  ];
});
export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromWarehouseId: uuid('from_warehouse_id').references(() => warehouseLocations.id).notNull(),
  toWarehouseId: uuid('to_warehouse_id').references(() => warehouseLocations.id).notNull(),
  stockId: uuid('stock_id').references(() => inventoryStock.id).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 4 }).notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // PENDING, IN_TRANSIT, COMPLETED, CANCELLED
  transferredBy: uuid('transferred_by').references(() => users.id),
  receivedBy: uuid('received_by').references(() => users.id),
  transferredAt: timestamp('transferred_at').defaultNow().notNull(),
  receivedAt: timestamp('received_at'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rawMaterialTransactions = pgTable('raw_material_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  materialId: uuid('material_id').references(() => rawMaterials.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // ADD, EDIT, DELETE
  quantityChange: decimal('quantity_change', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }).notNull(),
  remarks: text('remarks'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_raw_mat_tx_material').on(table.materialId),
    index('idx_raw_mat_tx_time').on(table.createdAt),
  ];
});

export const productStockTransactions = pgTable('product_stock_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // ADD, EDIT, DELETE
  quantityChange: decimal('quantity_change', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 12, scale: 2 }).notNull(),
  remarks: text('remarks'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_prod_stock_tx_product').on(table.productId),
    index('idx_prod_stock_tx_time').on(table.createdAt),
  ];
});

export const productionStock = pgTable('production_stock', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull().unique(),
  currentStock: decimal('current_stock', { precision: 12, scale: 2 }).default('0').notNull(), // Available Stock
  totalProduced: decimal('total_produced', { precision: 12, scale: 2 }).default('0').notNull(),
  totalDispatched: decimal('total_dispatched', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
