import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TallySyncService {
  private readonly logger = new Logger(TallySyncService.name);

  /**
   * Syncs sales data from Tally.
   * This architecture supports XML, JSON, or CSV ingestion.
   */
  async syncSalesData(tallyData: any[]) {
    this.logger.log(`Starting Tally sync for ${tallyData.length} records...`);
    
    return await db.transaction(async (tx) => {
      let syncCount = 0;
      
      for (const record of tallyData) {
        // 1. Ensure Customer exists
        let [customer] = await tx.select().from(customers).where(eq(customers.code, record.customerCode)).limit(1);
        if (!customer) {
          [customer] = await tx.insert(customers).values({
            name: record.customerName,
            code: record.customerCode,
            address: record.customerAddress,
            updatedAt: new Date()
          }).returning();
        }

        // 2. Insert Sales Order (Check for duplicates)
        const [existing] = await tx.select().from(salesOrders).where(eq(salesOrders.orderNumber, record.orderNumber)).limit(1);
        if (existing) continue;

        const [order] = await tx.insert(salesOrders).values({
          orderNumber: record.orderNumber,
          customerId: customer.id,
          factoryId: record.factoryId || 'default-factory-id', // Context from Tally mapping
          totalAmount: record.totalAmount,
          taxAmount: record.taxAmount,
          orderDate: new Date(record.orderDate),
          status: 'DELIVERED', // Tally usually syncs completed invoices
          paymentStatus: record.isPaid ? 'PAID' : 'PENDING',
          remarks: `Tally Sync: ${new Date().toISOString()}`
        }).returning();

        // 3. Insert Items
        if (record.items && record.items.length > 0) {
          for (const item of record.items) {
            await tx.insert(salesOrderItems).values({
              orderId: order.id,
              productId: item.productId, // Product mapping is required
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
            });
          }
        }
        
        syncCount++;
      }

      this.logger.log(`Sync completed. Processed ${syncCount} new sales records.`);
      return { status: 'success', synced: syncCount };
    });
  }

  /**
   * Fetches sales summary for the Admin Dashboard
   */
  async getSalesSummary() {
    const [summary] = await db.select({
      totalSales: sql<number>`SUM(${salesOrders.totalAmount})`,
      orderCount: sql<number>`COUNT(*)`,
      avgOrderValue: sql<number>`AVG(${salesOrders.totalAmount})`
    })
    .from(salesOrders);

    return summary;
  }
}
