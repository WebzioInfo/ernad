import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  productionLogs, productionBatches, batchTotals, 
  salesOrders, salesOrderItems, customers,
  products, productBrands, productionLines,
  users, roles, userRoles,
  incidents, finishedGoodsInventory,
  dispatchLogs, auditLogs, materialsUsage,
  rawMaterialTransactions, rawMaterials
} from '../../database/schema';
import { eq, and, sql, gte, lte, desc, between, inArray, notInArray } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private tableExistsCache = new Map<string, boolean>();

  private static readonly PRIVILEGED_ROLES = [
    'ADMIN',
  ];

  private async getExcludedUserIds() {
    const privilegedRoles = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.slug, ReportsService.PRIVILEGED_ROLES));
    
    if (privilegedRoles.length === 0) return [];
    
    const privilegedUserRoles = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.roleId, privilegedRoles.map(r => r.id)));
    
    return privilegedUserRoles.map(pur => pur.userId);
  }

  private async hasTable(tableName: string) {
    if (this.tableExistsCache.has(tableName)) {
      return this.tableExistsCache.get(tableName)!;
    }

    const [result] = await db.execute(sql`select to_regclass(${`public.${tableName}`}) as table_name`);
    const exists = Boolean(result?.table_name);
    this.tableExistsCache.set(tableName, exists);
    return exists;
  }

  // ─── PRODUCTION REPORTS ───

  async getProductionReport(filters: { 
    startDate: Date; 
    endDate: Date; 
    lineId?: string; 
    brandId?: string; 
    productId?: string;
  }) {
    try {
      const conditions = [between(productionLogs.loggedAt, filters.startDate, filters.endDate)];
      
      if (filters.lineId && filters.lineId !== 'all') conditions.push(eq(productionLogs.lineId, filters.lineId));
      if (filters.brandId && filters.brandId !== 'all') conditions.push(eq(productionLogs.brandId, filters.brandId));
      if (filters.productId && filters.productId !== 'all') conditions.push(eq(productionLogs.productId, filters.productId));

      const results = await db.select({
        lineId: productionLines.id,
        lineName: productionLines.name,
        brandName: productBrands.name,
        productName: products.name,
        totalOutput: sql<string>`COALESCE(SUM(${productionLogs.primaryCount}), '0')`,
        totalWastage: sql<string>`COALESCE(SUM(${productionLogs.wastageCount}), '0')`,
        rejectionRate: sql<string>`CASE WHEN SUM(${productionLogs.primaryCount}) > 0 THEN (SUM(${productionLogs.wastageCount})::float / SUM(${productionLogs.primaryCount})) * 100 ELSE '0' END`,
      })
      .from(productionLogs)
      .leftJoin(productionLines, eq(productionLogs.lineId, productionLines.id))
      .leftJoin(productBrands, eq(productionLogs.brandId, productBrands.id))
      .leftJoin(products, eq(productionLogs.productId, products.id))
      .where(and(...conditions))
      .groupBy(productionLines.id, productionLines.name, productBrands.name, products.name);

      const incidentCounts = await db.select({
        lineId: incidents.lineId,
        totalIncidents: sql<string>`COUNT(*)`,
        criticalIncidents: sql<string>`SUM(CASE WHEN ${incidents.priority} = 'CRITICAL' THEN 1 ELSE 0 END)`
      })
      .from(incidents)
      .where(between(incidents.openedAt, filters.startDate, filters.endDate))
      .groupBy(incidents.lineId);

      return results.map(r => {
        const lineIncidents = incidentCounts.find(i => i.lineId === r.lineId);
        return {
          ...r,
          totalOutput: Number(r.totalOutput),
          totalWastage: Number(r.totalWastage),
          rejectionRate: Number(r.rejectionRate),
          totalIncidents: Number(lineIncidents?.totalIncidents || 0),
          criticalIncidents: Number(lineIncidents?.criticalIncidents || 0)
        };
      });
    } catch (error: any) {
      this.logger.error(`[PRODUCTION_REPORT_FAILED] ${error.message}`);
      throw error;
    }
  }

  async getProductionBatches(filters: { startDate: string; endDate: string }) {
    try {
      return await db.select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        status: productionBatches.status,
        startTime: productionBatches.startTime,
        endTime: productionBatches.endTime,
        lineName: productionLines.name,
        productName: products.name,
        brandName: productBrands.name,
        blowingTotal: batchTotals.blowingTotal,
        fillingTotal: batchTotals.fillingTotal,
        labelingTotal: batchTotals.labelingTotal,
        packingTotal: batchTotals.packingTotal,
        scrapTotal: batchTotals.scrapTotal,
      })
      .from(productionBatches)
      .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .innerJoin(products, eq(productionBatches.productId, products.id))
      .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
      .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
      .where(between(sql`date(${productionBatches.startTime})`, filters.startDate, filters.endDate))
      .orderBy(desc(productionBatches.startTime));
    } catch (error: any) {
      this.logger.error(`[GET_PRODUCTION_BATCHES_FAILED] ${error.message}`);
      throw error;
    }
  }

  // ─── BATCH DOSSIER ───

  async getBatchDossier(batchId: string, callerRoles: string[] = []) {
    try {
      const isAdmin = callerRoles.includes('ADMIN');

      let query = db.select({
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
      .$dynamic();

      const [batchData] = await query.where(eq(productionBatches.id, batchId));

      if (!batchData) return null;

      const [extraTotals] = await db.select({
        boxCountTotal: sql<string>`COALESCE(SUM(${productionLogs.boxCount}), '0')`,
        labelUsageTotal: sql<string>`COALESCE(SUM(${productionLogs.labelUsage}), '0')`
      })
      .from(productionLogs)
      .where(eq(productionLogs.batchId, batchId));

      // Filter privileged names post-query for safety
      const excludedIds = await this.getExcludedUserIds();
      if (!isAdmin) {
        if (excludedIds.includes(batchData.batch.createdBy)) {
          batchData.creator = 'SYSTEM';
        }
      }

      const [totals] = await db.select().from(batchTotals).where(eq(batchTotals.batchId, batchId));
      
      const performance = await db.select({
        time: sql`date_trunc('hour', ${productionLogs.loggedAt})`,
        count: sql<string>`COALESCE(SUM(${productionLogs.primaryCount}), '0')`,
        waste: sql<string>`COALESCE(SUM(${productionLogs.wastageCount}), '0')`
      })
      .from(productionLogs)
      .where(eq(productionLogs.batchId, batchId))
      .groupBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`)
      .orderBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`);

      // ENHANCED BATCH DOSSIER DATA
      
      const stationLogsRaw = await db.select({
        station: productionLogs.station,
        count: sql<string>`COALESCE(SUM(${productionLogs.primaryCount}), '0')`,
        cases: sql<string>`COALESCE(SUM(${productionLogs.casesProduced}), '0')`,
        waste: sql<string>`COALESCE(SUM(${productionLogs.wastageCount}), '0')`,
        operatorName: users.name,
      })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .where(eq(productionLogs.batchId, batchId))
      .groupBy(productionLogs.station, users.name);

      const timelineRaw = await db.select({
        time: productionLogs.loggedAt,
        type: productionLogs.eventType,
        station: productionLogs.station,
        remarks: productionLogs.remarks,
        user: users.name,
      })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .where(eq(productionLogs.batchId, batchId))
      .orderBy(productionLogs.loggedAt);

      const dispatchInfo = await this.hasTable('dispatch_logs') ? await db.select({
        quantity: dispatchLogs.quantity,
        destination: dispatchLogs.destination,
        date: dispatchLogs.dispatchedAt
      })
      .from(dispatchLogs)
      .where(eq(dispatchLogs.batchId, batchId)) : [];

      const dispatchTotal = dispatchInfo.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
      
      const damagesTotal = [{ quantity: '0' }];

      const materialConsumption = await db.select({
        name: rawMaterials.name,
        unit: rawMaterials.unit,
        quantity: sql<string>`ABS(SUM(${rawMaterialTransactions.quantityChange}))`
      })
      .from(rawMaterialTransactions)
      .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
      .innerJoin(productionLogs, sql`position('(Log #' || ${productionLogs.id} || ')' in ${rawMaterialTransactions.remarks}) > 0`)
      .where(and(
        eq(productionLogs.batchId, batchId),
        eq(rawMaterialTransactions.type, 'CONSUMPTION')
      ))
      .groupBy(rawMaterials.name, rawMaterials.unit);

      return {
        metadata: batchData,
        materials: materialConsumption.map(m => ({
          name: m.name,
          unit: m.unit,
          quantity: Number(m.quantity)
        })),
        totals: {
          ...(totals || {}),
          boxCountTotal: Number(extraTotals?.boxCountTotal || 0),
          labelUsageTotal: Number(extraTotals?.labelUsageTotal || 0)
        },
        hourlyTrend: performance.map(p => ({
          ...p,
          count: Number(p.count),
          waste: Number(p.waste)
        })),
        stationLogs: stationLogsRaw.map(s => ({
           station: s.station,
           count: Number(s.count),
           cases: Number(s.cases),
           waste: Number(s.waste),
           operator: !isAdmin && excludedIds?.includes(s.operatorName) ? 'SYSTEM' : s.operatorName
        })),
        timeline: timelineRaw.map(t => ({
           ...t,
           user: !isAdmin && excludedIds?.includes(t.user) ? 'SYSTEM' : t.user
        })),
        dispatch: { total: dispatchTotal, logs: dispatchInfo },
        quality: { damages: Number(damagesTotal[0]?.quantity || 0), returns: 0 } // Returns 0 until separate integration
      };
    } catch (error: any) {
      this.logger.error(`[BATCH_DOSSIER_FAILED] ${error.message}`);
      throw error;
    }
  }

  // ─── SALES REPORTS ───

  async getSalesReport(filters: { startDate: Date; endDate: Date }, callerRoles: string[] = []) {
    try {
      this.logger.log(`[SALES_REPORT] Aggregating range: ${filters.startDate.toISOString()} - ${filters.endDate.toISOString()}`);

      const hasSalesTables = await this.hasTable('sales_orders') && await this.hasTable('sales_order_items');
      if (!hasSalesTables) {
        return {
          summary: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 },
          topProducts: []
        };
      }
      
      const conditions = [between(salesOrders.orderDate, filters.startDate, filters.endDate)];

      const summaryResults = await db.select({
        totalRevenue: sql<string>`COALESCE(SUM(${salesOrders.totalAmount}), '0')`,
        orderCount: sql<string>`COUNT(*)`,
        avgOrderValue: sql<string>`COALESCE(AVG(${salesOrders.totalAmount}), '0')`
      })
      .from(salesOrders)
      .where(and(...conditions));

      const summary = summaryResults[0] ? {
        totalRevenue: Number(summaryResults[0].totalRevenue),
        orderCount: Number(summaryResults[0].orderCount),
        avgOrderValue: Number(summaryResults[0].avgOrderValue)
      } : { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };

      const topProductsResults = await db.select({
        productId: products.id,
        productName: products.name,
        quantity: sql<string>`COALESCE(SUM(${salesOrderItems.quantity}), '0')`,
        revenue: sql<string>`COALESCE(SUM(${salesOrderItems.totalPrice}), '0')`
      })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
      .innerJoin(products, eq(salesOrderItems.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`SUM(${salesOrderItems.totalPrice})`))
      .limit(10);

      const stockResults = await this.hasTable('finished_goods_inventory')
        ? await db.select({
          productId: finishedGoodsInventory.productId,
          totalStock: sql<string>`SUM(${finishedGoodsInventory.quantity})`
        })
        .from(finishedGoodsInventory)
        .groupBy(finishedGoodsInventory.productId)
        : [];

      return {
        summary,
        topProducts: topProductsResults.map(p => {
          const stock = stockResults.find(s => s.productId === p.productId);
          return {
            ...p,
            quantity: Number(p.quantity),
            revenue: Number(p.revenue),
            currentStock: Number(stock?.totalStock || 0)
          };
        })
      };
    } catch (error: any) {
      this.logger.error(`[SALES_REPORT_FAILED] ${error.message}`, error.stack);
      throw error;
    }
  }

  // ─── ATTENDANCE REPORTS ───

  async getAttendanceReport(filters: { startDate: string; endDate: string }, callerRoles: string[] = []) {
    return [];
  }
}
