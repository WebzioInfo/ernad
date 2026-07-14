import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems, salesTransactions, products, productBrands, users, productionStock } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async getCustomers() {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getOrders() {
    return await db.select().from(salesOrders).orderBy(desc(salesOrders.orderDate));
  }

  async createCustomer(dto: {
    name: string;
    code?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    const { name, code, email, phone, address } = dto;
    if (!name || String(name).trim().length === 0) {
      throw new BadRequestException('Customer name is required');
    }

    const [customer] = await db.insert(customers).values({
      name: String(name).trim(),
      code: code ? String(code).trim() : null,
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      address: address ? String(address).trim() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return customer;
  }

  async getOrderById(id: string) {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Sales order not found');

    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, id));

    return { ...order, items };
  }

  async createOrder(dto: any, userId: string) {
    const [order] = await db.insert(salesOrders).values({
      ...dto,
      createdBy: userId,
    }).returning();
    return order;
  }

  async updateOrderStatus(id: string, status: any) {
    const [order] = await db.update(salesOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(salesOrders.id, id))
      .returning();
    return order;
  }

  // ─── SALES TRANSACTIONS ─────────────────────────────────────────────

  async getSalesTransactions() {
    return await db.select({
      id: salesTransactions.id,
      brandId: salesTransactions.brandId,
      brandName: productBrands.name,
      productId: salesTransactions.productId,
      productName: products.name,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      performedBy: salesTransactions.performedBy,
      userName: users.name,
      salesDate: salesTransactions.salesDate,
      customerId: salesTransactions.customerId,
      customerName: customers.name,
      unitPrice: salesTransactions.unitPrice,
      remarks: salesTransactions.remarks,
      updatedBy: salesTransactions.updatedBy,
      createdAt: salesTransactions.createdAt,
      updatedAt: salesTransactions.updatedAt,
    })
    .from(salesTransactions)
    .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
    .innerJoin(products, eq(salesTransactions.productId, products.id))
    .innerJoin(users, eq(salesTransactions.performedBy, users.id))
    .leftJoin(customers, eq(salesTransactions.customerId, customers.id))
    .orderBy(desc(salesTransactions.salesDate), desc(salesTransactions.createdAt));
  }

  async createSalesTransaction(dto: {
    brandId: string;
    productId: string;
    type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
    quantity: number;
    salesDate: string;
    customerId?: string;
    unitPrice?: number;
    remarks?: string;
  }, userId: string) {
    const { brandId, productId, type, quantity, salesDate, customerId, unitPrice, remarks } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate)) || !customerId) {
      throw new BadRequestException('Customer selection is required and all other fields must be valid');
    }
    if (unitPrice !== undefined && (isNaN(unitPrice) || unitPrice < 0)) {
      throw new BadRequestException('unitPrice must be a non-negative number');
    }

    return await db.transaction(async (tx) => {
      let runningStock = 0;
      let runningProduced = 0;
      let runningDispatched = 0;

      const existingStock = await tx.select().from(productionStock).where(eq(productionStock.productId, productId)).limit(1);
      const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) {
        throw new BadRequestException('Selected customer does not exist');
      }
      if (existingStock.length > 0) {
        runningStock = Number(existingStock[0].currentStock);
        runningProduced = Number(existingStock[0].totalProduced);
        runningDispatched = Number(existingStock[0].totalDispatched);
        if (type === 'RETURN') runningStock += quantity;
        else if (type === 'SALES_DISPATCH') {
           runningStock -= quantity;
           runningDispatched += quantity;
        }
        else if (type === 'DAMAGE') runningStock -= quantity;
      }

      // 1. Insert transaction record
      const [transaction] = await tx.insert(salesTransactions).values({
        brandId,
        productId,
        type,
        quantity,
        performedBy: userId,
        salesDate,
        customerId: customerId || null,
        unitPrice: unitPrice !== undefined ? String(unitPrice) : '0.00',
        remarks: remarks || null,
        stockBalanceAfter: String(runningStock),
        producedBalanceAfter: String(runningProduced),
        dispatchedBalanceAfter: String(runningDispatched),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // 2. Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // 3. Log Audit Action
      await this.auditService.logAction({
        userId,
        action: `SALES_${type}`,
        entityType: 'sales_transactions',
        entityId: transaction.id,
        category: 'SALES',
        payload: {
          brandId,
          productId,
          type,
          quantity,
          salesDate,
          customerId,
          unitPrice,
          remarks,
        },
      });

      return transaction;
    });
  }

  async updateSalesTransaction(id: string, dto: {
    brandId: string;
    productId: string;
    type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
    quantity: number;
    salesDate: string;
    customerId?: string;
    unitPrice?: number;
    remarks?: string;
  }, userId: string) {
    const { brandId, productId, type, quantity, salesDate, customerId, unitPrice, remarks } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate))) {
      throw new BadRequestException('Invalid input parameters or salesDate');
    }
    if (unitPrice !== undefined && (isNaN(unitPrice) || unitPrice < 0)) {
      throw new BadRequestException('unitPrice must be a non-negative number');
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTransactions).where(eq(salesTransactions.id, id)).for('update');
      if (!existing) {
        throw new NotFoundException('Sales transaction not found');
      }

      const [updated] = await tx.update(salesTransactions)
        .set({
          brandId,
          productId,
          type,
          quantity,
          salesDate,
          customerId: customerId || null,
          unitPrice: unitPrice !== undefined ? String(unitPrice) : '0.00',
          remarks: remarks || null,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(salesTransactions.id, id))
        .returning();

      // Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // Construct Diff summary for audit logs
      const changes: string[] = [];
      if (existing.quantity !== updated.quantity) {
        changes.push(`Quantity: ${existing.quantity} → ${updated.quantity}`);
      }
      if (existing.salesDate !== updated.salesDate) {
        changes.push(`Sales Date: ${existing.salesDate} → ${updated.salesDate}`);
      }
      if (existing.productId !== updated.productId) {
        changes.push(`Product ID: ${existing.productId} → ${updated.productId}`);
      }
      if (existing.brandId !== updated.brandId) {
        changes.push(`Brand ID: ${existing.brandId} → ${updated.brandId}`);
      }
      if (existing.type !== updated.type) {
        changes.push(`Type: ${existing.type} → ${updated.type}`);
      }
      if (existing.unitPrice !== updated.unitPrice) {
        changes.push(`Unit Price: ${existing.unitPrice} → ${updated.unitPrice}`);
      }
      if (existing.customerId !== updated.customerId) {
        changes.push(`Customer ID: ${existing.customerId || 'None'} → ${updated.customerId || 'None'}`);
      }
      if (existing.remarks !== updated.remarks) {
        changes.push(`Remarks: "${existing.remarks || ''}" → "${updated.remarks || ''}"`);
      }

      // Log Audit Action
      await this.auditService.logAction({
        userId,
        action: 'SALES_ENTRY_UPDATED',
        entityType: 'sales_transactions',
        entityId: id,
        category: 'SALES',
        payload: {
          before: existing,
          after: updated,
          changes: changes.join(', '),
        },
      });

      return updated;
    });
  }

  async deleteSalesTransaction(id: string, userId: string) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTransactions).where(eq(salesTransactions.id, id)).for('update');
      if (!existing) {
        throw new NotFoundException('Sales transaction not found');
      }

      await tx.delete(salesTransactions).where(eq(salesTransactions.id, id));

      // Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // Log Audit Action
      await this.auditService.logAction({
        userId,
        action: 'SALES_TRANSACTION_DELETE',
        entityType: 'sales_transactions',
        entityId: id,
        category: 'SALES',
        payload: {
          deletedRecord: existing,
        },
      });

      return { success: true };
    });
  }
}
