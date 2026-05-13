import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionLogs, batchTotals, productionBatches, 
  inventoryTransactions, inventoryStock, billOfMaterials 
} from '../../../database/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

@Injectable()
export class ProductionReconciliationService {
  private readonly logger = new Logger(ProductionReconciliationService.name);

  /**
   * Calculates the reconciliation for a specific batch.
   * Compares expected material consumption (BOM) vs actual recorded consumption.
   */
  async getBatchReconciliation(batchId: string) {
    // 1. Get Batch Info & Totals
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    const [totals] = await db.select().from(batchTotals).where(eq(batchTotals.batchId, batchId)).limit(1);

    if (!batch || !totals) return null;

    // 2. Get Actual Consumption from Ledger
    const actualConsumption = await db.select({
      stockId: inventoryTransactions.stockId,
      itemName: inventoryStock.itemName,
      totalQty: sql<number>`SUM(ABS(CAST(${inventoryTransactions.quantityChange} AS DECIMAL)))`
    })
    .from(inventoryTransactions)
    .innerJoin(inventoryStock, eq(inventoryTransactions.stockId, inventoryStock.id))
    .where(and(
      eq(inventoryTransactions.referenceId, batchId),
      eq(inventoryTransactions.type, 'CONSUMPTION')
    ))
    .groupBy(inventoryTransactions.stockId, inventoryStock.itemName);

    // 3. Get Expected Consumption (BOM)
    const bomItems = await db.select().from(billOfMaterials).where(eq(billOfMaterials.productId, batch.productId));
    
    const reconciliation = bomItems.map(bom => {
      const actual = actualConsumption.find(a => a.stockId === bom.stockId);
      const expected = Number(bom.quantityPerUnit) * totals.blowingTotal;
      const variance = (actual?.totalQty || 0) - expected;
      const variancePct = expected > 0 ? (variance / expected) * 100 : 0;

      return {
        material: actual?.itemName || 'Unknown Material',
        expected,
        actual: actual?.totalQty || 0,
        variance,
        variancePct: variancePct.toFixed(2),
        status: Math.abs(variancePct) > 5 ? 'CRITICAL' : 'NORMAL'
      };
    });

    // 4. Calculate OEE Components
    const quality = totals.blowingTotal > 0 ? (totals.packingTotal / totals.blowingTotal) * 100 : 0;
    
    return {
      batchCode: batch.batchCode,
      totals: {
        blowing: totals.blowingTotal,
        filling: totals.fillingTotal,
        packing: totals.packingTotal,
        rejection: totals.scrapTotal
      },
      materialReconciliation: reconciliation,
      qualityYield: quality.toFixed(2),
      efficiency: 85, // Placeholder for performance calculation
    };
  }

  async getShiftReport(shiftId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23,59,59,999);

    return await db.select({
      station: productionLogs.station,
      totalCount: sql<number>`SUM(${productionLogs.primaryCount})`,
      wasteCount: sql<number>`SUM(${productionLogs.wastageCount})`,
    })
    .from(productionLogs)
    .where(and(
      eq(productionLogs.shiftId, shiftId),
      gte(productionLogs.loggedAt, dayStart),
      lte(productionLogs.loggedAt, dayEnd)
    ))
    .groupBy(productionLogs.station);
  }
}
