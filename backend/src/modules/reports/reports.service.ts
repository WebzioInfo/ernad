import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  productionLogs, productionBatches, batchTotals, 
  salesOrders, salesOrderItems, customers,
  products, productBrands, productionLines,
  users, roles, userRoles,
  incidents, finishedGoodsInventory,
  dispatchLogs, auditLogs, materialsUsage,
  rawMaterialTransactions, rawMaterials, inventoryLedger, inventoryStock,
  billOfMaterials
} from '../../database/schema';
import { eq, and, sql, gte, lte, desc, between, inArray, notInArray, isNull } from 'drizzle-orm';
import { getProducedQuantitySql, getWastageQuantitySql } from '../../common/utils/production-metrics.helper';

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
      const conditions = [
        between(productionBatches.endTime, filters.startDate, filters.endDate),
        inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
        sql`${productionBatches.deletedAt} IS NULL`
      ];
      
      if (filters.lineId && filters.lineId !== 'all') conditions.push(eq(productionBatches.lineId, filters.lineId));
      if (filters.brandId && filters.brandId !== 'all') conditions.push(eq(productionBatches.brandId, filters.brandId));
      if (filters.productId && filters.productId !== 'all') conditions.push(eq(productionBatches.productId, filters.productId));

      const results = await db.select({
        lineId: productionLines.id,
        lineName: productionLines.name,
        brandName: sql<string>`STRING_AGG(DISTINCT ${productBrands.name}, ', ')`,
        productName: sql<string>`STRING_AGG(DISTINCT ${products.name}, ', ')`,
        totalCases: sql<number>`COALESCE(SUM(${batchTotals.casesTotal}), 0)`,
        totalOutput: sql<number>`COALESCE(SUM(${batchTotals.packingTotal}), 0)`,
        totalWastage: sql<number>`COALESCE(SUM(${batchTotals.scrapTotal}), 0)`,
      })
      .from(productionBatches)
      .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
      .leftJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
      .leftJoin(products, eq(productionBatches.productId, products.id))
      .where(and(...conditions))
      .groupBy(productionLines.id, productionLines.name);

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
        
        const sumCases = Number(r.totalCases);
        const out = Number(r.totalOutput);
        const waste = Number(r.totalWastage);
        const rejectionRate = (out + waste) > 0 ? (waste / (out + waste)) * 100 : 0;

        return {
          ...r,
          totalCases: sumCases,
          totalOutput: out,
          totalWastage: waste,
          rejectionRate: Number(rejectionRate.toFixed(2)),
          totalIncidents: Number(lineIncidents?.totalIncidents || 0),
          criticalIncidents: Number(lineIncidents?.criticalIncidents || 0),
          brandName: r.brandName || 'Multiple',
          productName: r.productName || 'Multiple'
        };
      });
    } catch (error: any) {
      this.logger.error(`[PRODUCTION_REPORT_FAILED] ${error.message}`);
      throw error;
    }
  }

  async getProductionReportDetails(filters: { startDate: Date; endDate: Date; lineId: string; productId?: string; }) {
    try {
      const { startDate, endDate, lineId, productId } = filters;
      
      const batchConditions = [
        between(productionBatches.endTime, startDate, endDate),
        inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
        sql`${productionBatches.deletedAt} IS NULL`,
        eq(productionBatches.lineId, lineId)
      ];
      
      if (productId) {
        batchConditions.push(eq(productionBatches.productId, productId));
      }

      // 1. Fetch Completed Batches
      const batches = await db.select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        productId: productionBatches.productId,
        blowingTotal: batchTotals.blowingTotal,
        fillingTotal: batchTotals.fillingTotal,
        labelingTotal: batchTotals.labelingTotal,
        packingTotal: batchTotals.packingTotal,
        scrapTotal: batchTotals.scrapTotal,
        casesTotal: batchTotals.casesTotal,
        unitsPerCase: products.unitsPerCase
      })
      .from(productionBatches)
      .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
      .leftJoin(products, eq(productionBatches.productId, products.id))
      .where(and(...batchConditions))
      .orderBy(desc(productionBatches.endTime));

      const batchIds = batches.map(b => b.id);

      if (batchIds.length === 0) {
        this.logger.log(`[DOSSIER_RECONCILIATION] Line: ${lineId} | Range: ${startDate.toISOString()} to ${endDate.toISOString()} | No Batches Found`);
        return {
          summary: {
            producedCases: 0,
            producedUnits: 0,
            rejectedUnits: 0,
            qualityYield: 100,
            dispatchQty: 0
          },
          logs: [],
          materialConsumption: [],
          stationAnalysis: [
            { station: 'Blowing Output (Units)', output: 0, waste: 0, yieldPct: 100 },
            { station: 'Filling Output (Units)', output: 0, waste: 0, yieldPct: 100 },
            { station: 'Labeling Output (Units)', output: 0, waste: 0, yieldPct: 100 },
            { station: 'Packing Cases', output: 0, waste: 0, yieldPct: 100 }
          ],
          skuRecipe: [],
          materialVariance: [],
          costSummary: {
            materialCost: 0,
            wastageCost: 0,
            productionCost: 0,
            estimatedRevenue: 0,
            margin: 0
          },
          batches: [],
          reconciliation: {
            selectedBatchIds: [],
            summaryCases: 0,
            summaryWaste: 0,
            telemetryCount: 0,
            materialTransactionsCount: 0
          }
        };
      }

      // 2. Calculate Aggregations
      let outputNum = 0;
      let wastageNum = 0;
      let producedCases = 0;

      batches.forEach(b => {
        producedCases += Number(b.casesTotal || 0);
        outputNum += Number(b.packingTotal || 0);
        wastageNum += Number(b.scrapTotal || 0);
      });

      const qualityYield = (outputNum + wastageNum) > 0 ? (outputNum / (outputNum + wastageNum)) * 100 : 100;

      // 3. Material Consumption via Log Linkage
      let materialConsumption = [];
      let logIds: any[] = [];
      let matchedTxsCount = 0;

      if (batchIds.length > 0) {
        const logsForBatches = await db.select({ id: productionLogs.id })
          .from(productionLogs)
          .where(and(
            inArray(productionLogs.batchId, batchIds),
            isNull(productionLogs.deletedAt)
          ));
        logIds = logsForBatches.map(l => l.id);
      }
      
      if (logIds.length > 0) {
        // Broad time window query to catch transactions created slightly before/after
        const windowStart = new Date(startDate.getTime() - 86400000 * 2);
        const windowEnd = new Date(endDate.getTime() + 86400000 * 2);
        
        const allTxs = await db.select({
          materialId: rawMaterials.id,
          materialName: rawMaterials.name,
          unit: rawMaterials.unit,
          consumed: rawMaterialTransactions.quantityChange,
          currentStock: rawMaterials.currentStock,
          remarks: rawMaterialTransactions.remarks
        })
        .from(rawMaterialTransactions)
        .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
        .where(
          and(
            eq(rawMaterialTransactions.type, 'CONSUMPTION'),
            between(rawMaterialTransactions.createdAt, windowStart, windowEnd)
          )
        );

        // Filter transactions linked to our specific logs
        const matchedTxs = allTxs.filter(tx => 
          tx.remarks && logIds.some(id => tx.remarks?.includes(`(Log #${id})`))
        );
        matchedTxsCount = matchedTxs.length;

        const consumptionMap = matchedTxs.reduce((acc, tx) => {
          if (!acc[tx.materialId]) {
            acc[tx.materialId] = {
              materialName: tx.materialName,
              unit: tx.unit,
              consumed: 0,
              currentStock: Number(tx.currentStock || 0)
            };
          }
          acc[tx.materialId].consumed += Math.abs(Number(tx.consumed || 0));
          return acc;
        }, {} as Record<string, { materialName: string, unit: string, consumed: number, currentStock: number }>);

        materialConsumption = Object.values(consumptionMap);
      }

      // 4. Dispatch Qty
      let dispatchQty = 0;
      if (batchIds.length > 0) {
        const dispatchResults = await db.select({
          totalDispatch: sql<number>`SUM(${inventoryLedger.quantityChange}) * -1`
        })
        .from(inventoryLedger)
        .where(
          and(
            inArray(inventoryLedger.batchId, batchIds),
            eq(inventoryLedger.type, 'DISPATCH')
          )
        );
        dispatchQty = Number((dispatchResults[0] as any)?.totalDispatch || 0);
      }

      // 5. Station Analysis (Strict Batch-Scope)
      const logs = await db.select({
        id: productionLogs.id,
        loggedAt: productionLogs.loggedAt,
        batchCode: productionBatches.batchCode,
        station: productionLogs.station,
        primaryCount: productionLogs.primaryCount,
        wastageCount: productionLogs.wastageCount,
        casesProduced: productionLogs.casesProduced
      })
      .from(productionLogs)
      .leftJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
      .where(and(
        inArray(productionLogs.batchId, batchIds),
        isNull(productionLogs.deletedAt)
      ))
      .orderBy(desc(productionLogs.loggedAt));

      const getYield = (out: number, w: number) => (out + w) > 0 ? (out / (out + w)) * 100 : 100;
      
      const stationAnalysis = [
        {
          station: 'Blowing Output (Units)',
          output: logs.filter(l => l.station === 'BLOWING').reduce((sum, l) => sum + Number(l.primaryCount || 0), 0),
          waste: logs.filter(l => l.station === 'BLOWING').reduce((sum, l) => sum + Number(l.wastageCount || 0), 0),
          yieldPct: 0
        },
        {
          station: 'Filling Output (Units)',
          output: logs.filter(l => l.station === 'FILLING').reduce((sum, l) => sum + Number(l.primaryCount || 0), 0),
          waste: logs.filter(l => l.station === 'FILLING').reduce((sum, l) => sum + Number(l.wastageCount || 0), 0),
          yieldPct: 0
        },
        {
          station: 'Labeling Output (Units)',
          output: logs.filter(l => l.station === 'LABELING').reduce((sum, l) => sum + Number(l.primaryCount || 0), 0),
          waste: logs.filter(l => l.station === 'LABELING').reduce((sum, l) => sum + Number(l.wastageCount || 0), 0),
          yieldPct: 0
        },
        {
          station: 'Packing Cases',
          output: logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + Number(l.casesProduced || 0), 0),
          waste: logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + Number(l.wastageCount || 0), 0),
          yieldPct: 0
        }
      ];

      // Set correct yieldPct for each station using unit-based calculation
      stationAnalysis.forEach((s, idx) => {
        const stationName = ['BLOWING', 'FILLING', 'LABELING', 'PACKING'][idx];
        const stationLogs = logs.filter(l => l.station === stationName);
        const outUnits = stationLogs.reduce((sum, l) => sum + Number(l.primaryCount || 0), 0);
        const wasteUnits = stationLogs.reduce((sum, l) => sum + Number(l.wastageCount || 0), 0);
        s.yieldPct = Math.round(getYield(outUnits, wasteUnits) * 100) / 100;
      });

      // 7. SKU Recipe & Material Variance
      let bomData: any[] = [];
      let skuRecipe: any[] = [];
      let materialVariance: any[] = [];

      if (productId) {
        bomData = await db.select({
          stockId: billOfMaterials.stockId,
          itemName: inventoryStock.itemName,
          unit: inventoryStock.unit,
          qtyPerUnit: billOfMaterials.quantityPerUnit,
          valuationRate: inventoryStock.valuationRate
        })
        .from(billOfMaterials)
        .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id))
        .where(eq(billOfMaterials.productId, productId));
        
        skuRecipe = bomData.map(item => ({
          materialName: item.itemName,
          unit: item.unit,
          qtyPerUnit: Number(item.qtyPerUnit || 0)
        }));

        // Variance Calculation using Single Source of Truth packing output in units
        const packingOutput = outputNum;
        materialVariance = bomData.map(item => {
          const expected = Number(item.qtyPerUnit) * packingOutput;
          const actualMatch = materialConsumption.find(mc => 
            mc.materialName.toLowerCase() === item.itemName.toLowerCase() || 
            mc.materialName.includes(item.itemName) || 
            item.itemName.includes(mc.materialName)
          );
          const actual = actualMatch ? actualMatch.consumed : 0;
          return {
            materialName: item.itemName,
            unit: item.unit,
            expected,
            actual,
            variance: actual - expected
          };
        });
      }

      // Add items consumed that weren't in BOM
      materialConsumption.forEach(mc => {
        if (!materialVariance.find(mv => mv.materialName === mc.materialName)) {
          materialVariance.push({
            materialName: mc.materialName,
            unit: mc.unit,
            expected: 0,
            actual: mc.consumed,
            variance: mc.consumed
          });
        }
      });

      // 8. Cost Summary
      let materialCost = 0;
      materialVariance.forEach(mv => {
        const bomItem = bomData.find(b => b.itemName === mv.materialName);
        const rate = bomItem ? Number(bomItem.valuationRate || 0) : 0;
        // If rate is 0, let's use a mock cost for visualization purposes
        materialCost += mv.actual * (rate > 0 ? rate : 1.25);
      });

      const totalWastageUnits = wastageNum;
      const wastageCost = totalWastageUnits * 0.5; // Mock scrap value
      const productionCost = materialCost + wastageCost;
      
      // Estimated Revenue (Mock 50 per case until pricing module built)
      const estimatedRevenue = producedCases * 50;
      const margin = estimatedRevenue > 0 ? ((estimatedRevenue - productionCost) / estimatedRevenue) * 100 : 0;

      const costSummary = {
        materialCost,
        wastageCost,
        productionCost,
        estimatedRevenue,
        margin: Math.round(margin * 100) / 100
      };

      const mappedLogs = logs.map(l => ({
        ...l,
        output: l.station === 'PACKING' ? Number(l.casesProduced || 0) : Number(l.primaryCount || 0),
        unitType: l.station === 'PACKING' ? 'Cases' : 'Units'
      }));

      this.logger.log(`[DOSSIER_RECONCILIATION] Line: ${lineId} | Range: ${startDate.toISOString()} to ${endDate.toISOString()} | Batches: [${batchIds.join(', ')}] | Summary Cases: ${producedCases} | Summary Waste: ${wastageNum} | Telemetry Logs: ${logs.length} | Material Txs: ${matchedTxsCount}`);

      return {
        summary: {
          producedCases,
          producedUnits: outputNum,
          rejectedUnits: wastageNum,
          qualityYield,
          dispatchQty
        },
        logs: mappedLogs,
        materialConsumption,
        stationAnalysis,
        skuRecipe,
        materialVariance,
        costSummary,
        batches: [...new Set(batches.map(b => b.batchCode).filter(Boolean))],
        reconciliation: {
          selectedBatchIds: batchIds,
          summaryCases: producedCases,
          summaryWaste: wastageNum,
          telemetryCount: logs.length,
          materialTransactionsCount: matchedTxsCount
        }
      };

    } catch (error: any) {
      this.logger.error(`[GET_REPORT_DETAILS_FAILED] ${error.message}`);
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
        unitsPerCase: products.unitsPerCase,
        blowingTotal: batchTotals.blowingTotal,
        fillingTotal: batchTotals.fillingTotal,
        labelingTotal: batchTotals.labelingTotal,
        packingTotal: batchTotals.packingTotal,
        scrapTotal: batchTotals.scrapTotal,
        casesTotal: batchTotals.casesTotal,
      })
      .from(productionBatches)
      .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .innerJoin(products, eq(productionBatches.productId, products.id))
      .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
      .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
      .where(and(
        between(sql`date(${productionBatches.endTime})`, filters.startDate, filters.endDate),
        inArray(productionBatches.status, ['COMPLETED', 'CLOSED'])
      ))
      .orderBy(desc(productionBatches.endTime));
    } catch (error: any) {
      this.logger.error(`[GET_PRODUCTION_BATCHES_FAILED] ${error.message}`);
      throw error;
    }
  }

  // ─── BATCH DOSSIER ───

  

  async getOperationsLedgerReport(filters: { startDate: Date; endDate: Date }) {
    try {
      const { startDate, endDate } = filters;
      
      const reportData = await this.getProductionReport({ startDate, endDate });
      const batchesData = await this.getProductionBatches({ 
        startDate: startDate.toISOString().split('T')[0], 
        endDate: endDate.toISOString().split('T')[0] 
      });

      // Raw Material Consumption
      const materialConsumption = await db.select({
        materialId: rawMaterials.id,
        materialName: rawMaterials.name,
        unit: rawMaterials.unit,
        currentStock: rawMaterials.currentStock,
        consumed: sql<number>`ABS(SUM(${rawMaterialTransactions.quantityChange}))`
      })
      .from(rawMaterialTransactions)
      .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
      .where(and(
        eq(rawMaterialTransactions.type, 'CONSUMPTION'),
        between(rawMaterialTransactions.createdAt, startDate, endDate)
      ))
      .groupBy(rawMaterials.id, rawMaterials.name, rawMaterials.unit, rawMaterials.currentStock);

      // Dispatch Summary
      const dispatchSummary = await db.select({
        id: dispatchLogs.id,
        productName: products.name,
        cases: dispatchLogs.quantity,
        date: dispatchLogs.dispatchedAt,
        reference: dispatchLogs.vehicleNumber,
        destination: dispatchLogs.destination
      })
      .from(dispatchLogs)
      .leftJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
      .leftJoin(products, eq(productionBatches.productId, products.id))
      .where(between(dispatchLogs.dispatchedAt, startDate, endDate))
      .orderBy(desc(dispatchLogs.dispatchedAt));

      // Incident Summary
      const incidentSummary = await db.select({
        id: incidents.id,
        date: incidents.openedAt,
        lineName: productionLines.name,
        category: incidents.category,
        severity: incidents.priority,
        status: incidents.status
      })
      .from(incidents)
      .leftJoin(productionLines, eq(incidents.lineId, productionLines.id))
      .where(between(incidents.openedAt, startDate, endDate))
      .orderBy(desc(incidents.openedAt));

      // Top Operators
      const topOperators = await db.select({
        operatorName: users.name,
        lineName: productionLines.name,
        totalLogs: sql<number>`COUNT(${productionLogs.id})`,
        producedUnits: getProducedQuantitySql(),
        producedCases: sql<number>`COALESCE(SUM(CASE WHEN ${productionLogs.station}::text = 'PACKING' THEN ${productionLogs.casesProduced} ELSE 0 END), 0)`,
        wastage: getWastageQuantitySql()
      })
      .from(productionLogs)
      .innerJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(productionLines, eq(productionLogs.lineId, productionLines.id))
      .where(between(productionLogs.loggedAt, startDate, endDate))
      .groupBy(users.id, users.name, productionLines.id, productionLines.name)
      .orderBy(desc(getProducedQuantitySql()))
      .limit(10);

      // Material Wastage Analysis - Aggregated by Actual Materials (via BOM)
      const logsAggregation = await db.select({
        lineName: productionLines.name,
        materialName: inventoryStock.itemName,
        materialCode: inventoryStock.sku,
        materialType: inventoryStock.materialType,
        unit: inventoryStock.unit,
        
        expectedUsage: sql<number>`SUM(COALESCE(${productionLogs.primaryCount}::numeric, 0) * COALESCE(${billOfMaterials.quantityPerUnit}::numeric, 0))`,

        // Blowing (Preforms/Bottles)
        preformUsage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'BLOWING' AND ${inventoryStock.materialType}::text = 'PREFORM' THEN COALESCE(${productionLogs.bagsUsed}::numeric, 0) + COALESCE(${productionLogs.preformUsage}::numeric, 0) ELSE 0 END)`,
        bottleLeakage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'BLOWING' AND ${inventoryStock.materialType}::text = 'PREFORM' THEN COALESCE(${productionLogs.bottleLeakage}::numeric, 0) ELSE 0 END)`,
        
        // Filling (Caps)
        capUsage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'FILLING' AND ${inventoryStock.materialType}::text = 'CAP' THEN COALESCE(${productionLogs.capBoxUsage}::numeric, 0) + COALESCE(${productionLogs.capUsage}::numeric, 0) ELSE 0 END)`,
        capWastage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'FILLING' AND ${inventoryStock.materialType}::text = 'CAP' THEN COALESCE(${productionLogs.capWastage}::numeric, 0) ELSE 0 END)`,
        
        // Labeling (Labels)
        labelUsage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'LABELING' AND ${inventoryStock.materialType}::text = 'LABEL' THEN COALESCE(${productionLogs.bopRollUsage}::numeric, 0) + COALESCE(${productionLogs.labelUsage}::numeric, 0) ELSE 0 END)`,
        labelWastage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'LABELING' AND ${inventoryStock.materialType}::text = 'LABEL' THEN COALESCE(${productionLogs.damagedLabelWeight}::numeric, 0) + COALESCE(${productionLogs.wastageCount}::numeric, 0) ELSE 0 END)`,
        
        // Packing (Shrink Roll)
        shrinkUsage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'PACKING' AND ${inventoryStock.materialType}::text = 'SHRINK' THEN COALESCE(${productionLogs.shrinkWeightUsed}::numeric, 0) ELSE 0 END)`,
        shrinkWastage: sql<number>`SUM(CASE WHEN ${productionLogs.station}::text = 'PACKING' AND ${inventoryStock.materialType}::text = 'SHRINK' THEN COALESCE(${productionLogs.shrinkWastageKg}::numeric, 0) ELSE 0 END)`
      })
      .from(productionLogs)
      .innerJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
      .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .innerJoin(billOfMaterials, eq(productionLogs.productId, billOfMaterials.productId))
      .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id))
      .where(and(
        between(productionLogs.loggedAt, startDate, endDate),
        inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
        isNull(productionLogs.deletedAt),
        notInArray(productionLogs.status, ['DRAFT', 'REJECTED'])
      ))
      .groupBy(productionLines.name, inventoryStock.itemName, inventoryStock.sku, inventoryStock.materialType, inventoryStock.unit);

      const lineMaterialWastage: any[] = [];
      logsAggregation.forEach(row => {
        if (!row.materialName) return;

        let consumed = 0;
        let wastage = 0;

        switch (row.materialType) {
          case 'PREFORM':
            consumed = Number(row.preformUsage);
            wastage = Number(row.bottleLeakage);
            break;
          case 'CAP':
            consumed = Number(row.capUsage);
            wastage = Number(row.capWastage);
            break;
          case 'LABEL':
            consumed = Number(row.labelUsage);
            wastage = Number(row.labelWastage);
            break;
          case 'SHRINK':
            consumed = Number(row.shrinkUsage);
            wastage = Number(row.shrinkWastage);
            break;
        }

        if (consumed > 0 || wastage > 0) {
          const expected = Number(row.expectedUsage);
          const variance = expected > 0 ? ((consumed - expected) / expected) * 100 : 0;
          
          lineMaterialWastage.push({ 
            lineName: row.lineName, 
            materialName: row.materialName,
            materialCode: row.materialCode || 'N/A',
            unit: row.unit || 'N/A', 
            totalConsumed: consumed, 
            totalWastage: wastage,
            variance: Math.round(variance * 100) / 100
          });
        }
      });

      return {
        reportData,
        batchesData,
        lineMaterialWastage: lineMaterialWastage.map(m => {
          const consumed = Number(m.totalConsumed || 0);
          const waste = Number(m.totalWastage || 0);
          const variance = consumed > 0 ? (waste / consumed) * 100 : 0;
          return {
            ...m,
            totalConsumed: consumed,
            totalWastage: waste,
            variance: Number(variance.toFixed(2))
          };
        }),
        materialConsumption: materialConsumption.map(m => ({
          ...m,
          consumed: Number(m.consumed || 0),
          currentStock: Number(m.currentStock || 0)
        })),
        dispatchSummary: dispatchSummary.map(d => ({
          ...d,
          cases: Number(d.cases || 0)
        })),
        incidentSummary,
        topOperators: topOperators.map(o => {
          const out = Number(o.producedUnits || 0);
          const waste = Number(o.wastage || 0);
          const yieldPct = (out + waste) > 0 ? (out / (out + waste)) * 100 : 100;
          return {
            ...o,
            producedUnits: out,
            producedCases: Number(o.producedCases || 0),
            yieldPct
          };
        })
      };
    } catch (error: any) {
      this.logger.error(`[GET_OPERATIONS_LEDGER_FAILED] ${error.message}`);
      throw error;
    }
  }
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

      // Fetch all log IDs for this batch first
      const logs = await db.select({ id: productionLogs.id })
        .from(productionLogs)
        .where(eq(productionLogs.batchId, batchId));
      
      let materialConsumption: any[] = [];
      if (logs.length > 0) {
        const logIds = logs.map(l => l.id);
        const startTime = batchData.batch.startTime;
        const endTime = batchData.batch.endTime || new Date();
        const bufferStart = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
        const bufferEnd = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);

        // Fetch transaction records within the timeframe using index
        const txs = await db.select({
          name: rawMaterials.name,
          unit: rawMaterials.unit,
          currentStock: rawMaterials.currentStock,
          quantityChange: rawMaterialTransactions.quantityChange,
          remarks: rawMaterialTransactions.remarks
        })
        .from(rawMaterialTransactions)
        .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
        .where(and(
          eq(rawMaterialTransactions.type, 'CONSUMPTION'),
          gte(rawMaterialTransactions.createdAt, bufferStart),
          lte(rawMaterialTransactions.createdAt, bufferEnd)
        ));

        // Filter and aggregate in memory to completely bypass the substring scan
        const logIdStrings = new Set(logIds.map(id => `Log #${id}`));
        const materialGroups = new Map<string, { name: string; unit: string; currentStock: string; sum: number }>();
        
        for (const tx of txs) {
          if (!tx.remarks) continue;
          const index = tx.remarks.indexOf('Log #');
          if (index === -1) continue;

          let end = index + 5;
          while (end < tx.remarks.length && tx.remarks.charCodeAt(end) >= 48 && tx.remarks.charCodeAt(end) <= 57) {
            end++;
          }
          const parsedId = tx.remarks.substring(index + 5, end);
          if (logIdStrings.has(`Log #${parsedId}`)) {
            const key = tx.name;
            const qty = Math.abs(Number(tx.quantityChange || 0));
            const existing = materialGroups.get(key);
            if (existing) {
              existing.sum += qty;
            } else {
              materialGroups.set(key, {
                name: tx.name,
                unit: tx.unit,
                currentStock: String(tx.currentStock || 0),
                sum: qty
              });
            }
          }
        }

        materialConsumption = Array.from(materialGroups.values()).map(g => ({
          name: g.name,
          unit: g.unit,
          currentStock: g.currentStock,
          quantity: String(g.sum)
        }));
      }

      return {
        metadata: batchData,
        materials: materialConsumption.map(m => ({
          name: m.name,
          unit: m.unit,
          currentStock: Number(m.currentStock || 0),
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
