import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  productionLogs, productionBatches, batchTotals, 
  salesOrders, salesOrderItems, customers,
  products, productBrands, productionLines, shifts,
  dailyAttendance, users
} from '../../database/schema';
import { eq, and, sql, gte, lte, desc, between } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  // ─── PRODUCTION REPORTS ───

  async getProductionReport(filters: { 
    startDate: Date; 
    endDate: Date; 
    lineId?: string; 
    brandId?: string; 
    productId?: string;
    factoryId?: string;
  }) {
    const conditions = [between(productionLogs.loggedAt, filters.startDate, filters.endDate)];
    
    if (filters.lineId && filters.lineId !== 'all') conditions.push(eq(productionLogs.lineId, filters.lineId));
    if (filters.brandId && filters.brandId !== 'all') conditions.push(eq(productionLogs.brandId, filters.brandId));
    if (filters.productId && filters.productId !== 'all') conditions.push(eq(productionLogs.productId, filters.productId));
    if (filters.factoryId) conditions.push(eq(productionLogs.factoryId, filters.factoryId));

    const results = await db.select({
      lineName: productionLines.name,
      brandName: productBrands.name,
      productName: products.name,
      totalOutput: sql<number>`SUM(${productionLogs.primaryCount})`,
      totalWastage: sql<number>`SUM(${productionLogs.wastageCount})`,
      rejectionRate: sql<number>`CASE WHEN SUM(${productionLogs.primaryCount}) > 0 THEN (SUM(${productionLogs.wastageCount})::float / SUM(${productionLogs.primaryCount})) * 100 ELSE 0 END`,
    })
    .from(productionLogs)
    .leftJoin(productionLines, eq(productionLogs.lineId, productionLines.id))
    .leftJoin(productBrands, eq(productionLogs.brandId, productBrands.id))
    .leftJoin(products, eq(productionLogs.productId, products.id))
    .where(and(...conditions))
    .groupBy(productionLines.name, productBrands.name, products.name);

    return results;
  }

  // ─── BATCH DOSSIER ───

  async getBatchDossier(batchId: string) {
    const [batchData] = await db.select({
      batch: productionBatches,
      line: productionLines,
      product: products,
      brand: productBrands,
      creator: users.name
    })
    .from(productionBatches)
    .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
    .innerJoin(products, eq(productionBatches.productId, products.id))
    .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .leftJoin(users, eq(productionBatches.createdBy, users.id))
    .where(eq(productionBatches.id, batchId));

    if (!batchData) return null;

    const [totals] = await db.select().from(batchTotals).where(eq(batchTotals.batchId, batchId));
    
    const performance = await db.select({
      time: sql`date_trunc('hour', ${productionLogs.loggedAt})`,
      count: sql<number>`SUM(${productionLogs.primaryCount})`,
      waste: sql<number>`SUM(${productionLogs.wastageCount})`
    })
    .from(productionLogs)
    .where(eq(productionLogs.batchId, batchId))
    .groupBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`)
    .orderBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`);

    return {
      metadata: batchData,
      totals: totals || {},
      hourlyTrend: performance
    };
  }

  // ─── SALES REPORTS ───

  async getSalesReport(filters: { startDate: Date; endDate: Date; factoryId?: string }) {
    const conditions = [between(salesOrders.orderDate, filters.startDate, filters.endDate)];
    if (filters.factoryId) conditions.push(eq(salesOrders.factoryId, filters.factoryId));

    const summary = await db.select({
      totalRevenue: sql<number>`SUM(${salesOrders.totalAmount})`,
      orderCount: sql<number>`COUNT(*)`,
      avgOrderValue: sql<number>`AVG(${salesOrders.totalAmount})`
    })
    .from(salesOrders)
    .where(and(...conditions));

    const topProducts = await db.select({
      productName: products.name,
      quantity: sql<number>`SUM(${salesOrderItems.quantity})`,
      revenue: sql<number>`SUM(${salesOrderItems.totalPrice})`
    })
    .from(salesOrderItems)
    .innerJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
    .innerJoin(products, eq(salesOrderItems.productId, products.id))
    .where(and(...conditions))
    .groupBy(products.name)
    .orderBy(desc(sql`SUM(${salesOrderItems.totalPrice})`))
    .limit(10);

    return {
      summary: summary[0],
      topProducts
    };
  }

  // ─── ATTENDANCE REPORTS ───

  async getAttendanceReport(filters: { startDate: string; endDate: string }) {
    return await db.select({
      userName: users.name,
      department: users.department,
      date: dailyAttendance.date,
      checkIn: dailyAttendance.checkIn,
      checkOut: dailyAttendance.checkOut,
      workedHours: dailyAttendance.workedHours,
      status: dailyAttendance.status,
      lateMinutes: dailyAttendance.lateMinutes
    })
    .from(dailyAttendance)
    .innerJoin(users, eq(dailyAttendance.userId, users.id))
    .where(between(dailyAttendance.date, filters.startDate, filters.endDate))
    .orderBy(desc(dailyAttendance.date), users.name);
  }
}
