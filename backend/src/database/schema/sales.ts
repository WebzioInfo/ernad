import { pgTable, uuid, varchar, timestamp, decimal, integer, index, text, pgEnum, date } from 'drizzle-orm/pg-core';
import { products, productBrands } from './master-data';
import { users } from './users';
import { productionBatches } from './production';

export const orderStatusEnum = pgEnum('order_status', ['DRAFT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PARTIAL', 'PAID', 'REFUNDED']);
export const salesTransactionTypeEnum = pgEnum('sales_transaction_type', ['SALES_DISPATCH', 'RETURN', 'DAMAGE']);

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  businessName: varchar('business_name', { length: 255 }),
  customerType: varchar('customer_type', { length: 50 }).default('BUSINESS').notNull(),
  gstNumber: varchar('gst_number', { length: 15 }),
  panNumber: varchar('pan_number', { length: 10 }),
  alternativePhone: varchar('alternative_phone', { length: 20 }),
  billingAddress: text('billing_address'),
  shippingAddress: text('shipping_address'),
  state: varchar('state', { length: 100 }),
  district: varchar('district', { length: 100 }),
  country: varchar('country', { length: 100 }),
  pinCode: varchar('pin_code', { length: 20 }),
  openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  openingBalanceType: varchar('opening_balance_type', { length: 10 }).default('DEBIT').notNull(),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at'),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  companyId: uuid('company_id'),
  branchId: uuid('branch_id'),
  tenantId: uuid('tenant_id'),
});

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }).notNull(),
  status: orderStatusEnum('status').default('DRAFT').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('PENDING').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  orderDate: timestamp('order_date').defaultNow().notNull(),
  deliveryDate: timestamp('delivery_date'),
  createdBy: uuid('created_by').references(() => users.id),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_sales_orders_customer').on(table.customerId),
    index('idx_sales_orders_date').on(table.orderDate),
    index('idx_sales_orders_status').on(table.status),
  ];
});

export const salesOrderItems = pgTable('sales_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => salesOrders.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }).notNull(),
  batchId: uuid('batch_id').references(() => productionBatches.id), // Link to production
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesPayments = pgTable('sales_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => salesOrders.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // CASH, BANK_TRANSFER, CHEQUE
  referenceNumber: varchar('reference_number', { length: 100 }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesTransactions = pgTable('sales_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').references(() => productBrands.id, { onDelete: 'restrict' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }).notNull(),
  type: salesTransactionTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  performedBy: uuid('performed_by').references(() => users.id).notNull(),
  salesDate: date('sales_date').notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).default('0.00'),
  remarks: text('remarks'),
  updatedBy: uuid('updated_by').references(() => users.id),

  // Historical Snapshot Columns (Enterprise Ledger)
  stockBalanceAfter: decimal('stock_balance_after', { precision: 12, scale: 2 }),
  producedBalanceAfter: decimal('produced_balance_after', { precision: 12, scale: 2 }),
  dispatchedBalanceAfter: decimal('dispatched_balance_after', { precision: 12, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('idx_sales_transactions_brand').on(table.brandId),
    index('idx_sales_transactions_product').on(table.productId),
    index('idx_sales_transactions_date').on(table.salesDate),
  ];
});
