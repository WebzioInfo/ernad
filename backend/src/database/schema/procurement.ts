import { pgTable, uuid, varchar, timestamp, decimal, integer, index, text, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { factories } from './master-data';

export const poStatusEnum = pgEnum('po_status', ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED']);
export const grnStatusEnum = pgEnum('grn_status', ['DRAFT', 'COMPLETED', 'CANCELLED']);

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  contactPerson: varchar('contact_person', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  taxId: varchar('tax_id', { length: 50 }),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'restrict' }).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id, { onDelete: 'restrict' }).notNull(),
  status: poStatusEnum('status').default('DRAFT').notNull(),
  orderDate: timestamp('order_date').defaultNow().notNull(),
  expectedDelivery: timestamp('expected_delivery'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).default('0'),
  createdBy: uuid('created_by').references(() => users.id),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_po_vendor').on(table.vendorId),
    index('idx_po_status').on(table.status),
    index('idx_po_number').on(table.poNumber),
  ];
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  poId: uuid('po_id').references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 15, scale: 2 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 12, scale: 3 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goodsReceipts = pgTable('goods_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  grnNumber: varchar('grn_number', { length: 50 }).notNull().unique(),
  poId: uuid('po_id').references(() => purchaseOrders.id),
  vendorId: uuid('vendor_id').references(() => vendors.id).notNull(),
  factoryId: uuid('factory_id').references(() => factories.id).notNull(),
  receivedDate: timestamp('received_date').defaultNow().notNull(),
  status: grnStatusEnum('status').default('COMPLETED').notNull(),
  receivedBy: uuid('received_by').references(() => users.id),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const goodsReceiptItems = pgTable('goods_receipt_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  grnId: uuid('grn_id').references(() => goodsReceipts.id, { onDelete: 'cascade' }).notNull(),
  poItemId: uuid('po_item_id').references(() => purchaseOrderItems.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }), // Supplier batch
  expiryDate: timestamp('expiry_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
