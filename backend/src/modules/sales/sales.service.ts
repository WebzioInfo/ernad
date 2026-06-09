import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems, salesTransactions, products, productBrands, users } from '../../database/schema';
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
      createdAt: salesTransactions.createdAt,
      updatedAt: salesTransactions.updatedAt,
    })
    .from(salesTransactions)
    .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
    .innerJoin(products, eq(salesTransactions.productId, products.id))
    .innerJoin(users, eq(salesTransactions.performedBy, users.id))
    .orderBy(desc(salesTransactions.salesDate), desc(salesTransactions.createdAt));
  }

  async createSalesTransaction(dto: { brandId: string; productId: string; type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE'; quantity: number; salesDate: string }, userId: string) {
    const { brandId, productId, type, quantity, salesDate } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate))) {
      throw new BadRequestException('Invalid input parameters or salesDate');
    }

    return await db.transaction(async (tx) => {
      // 1. Insert transaction record
      const [transaction] = await tx.insert(salesTransactions).values({
        brandId,
        productId,
        type,
        quantity,
        performedBy: userId,
        salesDate,
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
        },
      });

      return transaction;
    });
  }

  async updateSalesTransaction(id: string, dto: { brandId: string; productId: string; type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE'; quantity: number; salesDate: string }, userId: string) {
    const { brandId, productId, type, quantity, salesDate } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate))) {
      throw new BadRequestException('Invalid input parameters or salesDate');
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

      // Log Audit Action
      await this.auditService.logAction({
        userId,
        action: 'SALES_TRANSACTION_UPDATE',
        entityType: 'sales_transactions',
        entityId: id,
        category: 'SALES',
        payload: {
          before: existing,
          after: updated,
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
