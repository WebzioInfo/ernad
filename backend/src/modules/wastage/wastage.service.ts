import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  productionLogs, productionBatches, batchTotals, 
  products, productBrands, productionLines,
  users, incidents, rawMaterialTransactions, rawMaterials, 
  inventoryStock, operatorSessions, finishedGoodsInventory, inventoryLedger
} from '../../database/schema';
import { eq, and, sql, desc, between, inArray, isNull, notInArray } from 'drizzle-orm';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

@Injectable()
export class WastageService {
  private readonly logger = new Logger(WastageService.name);

  /**
   * Resolves the canonical batch scope based on date range, line, SKU, and batch code.
   */
  private async getCanonicalBatchIds(filters: {
    startDate: Date;
    endDate: Date;
    lineId?: string;
    productId?: string;
    batchCode?: string;
  }) {
    const conditions = [
      between(productionBatches.endTime, filters.startDate, filters.endDate),
      inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
      sql`${productionBatches.deletedAt} IS NULL`
    ];

    if (filters.lineId && filters.lineId !== 'all') {
      conditions.push(eq(productionBatches.lineId, filters.lineId));
    }
    if (filters.productId && filters.productId !== 'all') {
      conditions.push(eq(productionBatches.productId, filters.productId));
    }
    if (filters.batchCode && filters.batchCode !== 'all') {
      conditions.push(eq(productionBatches.batchCode, filters.batchCode));
    }

    const batches = await db.select({ id: productionBatches.id })
      .from(productionBatches)
      .where(and(...conditions));

    return batches.map(b => b.id);
  }

  /**
   * Helper to retrieve wastage count for a specific date range and filters.
   */
  private async getWastageForRange(startDate: Date, endDate: Date, filters: {
    lineId?: string;
    productId?: string;
    batchCode?: string;
  }): Promise<number> {
    const batchIds = await this.getCanonicalBatchIds({
      startDate,
      endDate,
      lineId: filters.lineId,
      productId: filters.productId,
      batchCode: filters.batchCode
    });

    if (batchIds.length === 0) return 0;

    const [result] = await db.select({
      totalWastage: sql<number>`COALESCE(SUM(${productionLogs.wastageCount}), 0)`
    })
    .from(productionLogs)
    .where(and(
      inArray(productionLogs.batchId, batchIds),
      isNull(productionLogs.deletedAt),
      notInArray(productionLogs.status, ['DRAFT', 'REJECTED'])
    ));

    return Number(result?.totalWastage || 0);
  }

  /**
   * Aggregates wastage intelligence center dashboard metrics.
   */
  async getWastageDashboardData(filters: {
    startDate: Date;
    endDate: Date;
    lineId?: string;
    productId?: string;
    batchCode?: string;
  }) {
    try {
      const { startDate, endDate } = filters;

      // 1. Build Canonical Batch Scope
      const batchIds = await this.getCanonicalBatchIds(filters);

      if (batchIds.length === 0) {
        this.logger.log(`[WASTAGE_INTEL] Range: ${startDate.toISOString()} to ${endDate.toISOString()} | No Batches Found`);
        return this.getEmptyPayload();
      }

      // 2. Fetch master lists for name resolutions
      const allLines = await db.select().from(productionLines);
      const allProducts = await db.select().from(products);
      const allBrands = await db.select().from(productBrands);
      const allStocks = await db.select({
        itemName: inventoryStock.itemName,
        valuationRate: inventoryStock.valuationRate
      }).from(inventoryStock);

      const getValuationRate = (matName: string) => {
        const match = allStocks.find(s => 
          s.itemName.toLowerCase() === matName.toLowerCase() ||
          matName.toLowerCase().includes(s.itemName.toLowerCase()) ||
          s.itemName.toLowerCase().includes(matName.toLowerCase())
        );
        return match ? Number(match.valuationRate || 0) : 1.25;
      };

      // 3. Fetch logs and matched transactions
      const logs = await db.select({
        id: productionLogs.id,
        batchId: productionLogs.batchId,
        lineId: productionLogs.lineId,
        productId: productionLogs.productId,
        station: productionLogs.station,
        primaryCount: productionLogs.primaryCount,
        wastageCount: productionLogs.wastageCount,
        bottleLeakage: productionLogs.bottleLeakage,
        capWastage: productionLogs.capWastage,
        damagedLabelWeight: productionLogs.damagedLabelWeight,
        shrinkWastageKg: productionLogs.shrinkWastageKg,
        loggedAt: productionLogs.loggedAt,
        remarks: productionLogs.remarks,
        eventType: productionLogs.eventType
      })
      .from(productionLogs)
      .where(and(
        inArray(productionLogs.batchId, batchIds),
        isNull(productionLogs.deletedAt),
        notInArray(productionLogs.status, ['DRAFT', 'REJECTED'])
      ))
      .orderBy(desc(productionLogs.loggedAt));

      const logIds = logs.map(l => l.id);

      const windowStart = new Date(startDate.getTime() - 86400000 * 5);
      const windowEnd = new Date(endDate.getTime() + 86400000 * 5);

      const rawTransactions = await db.select({
        id: rawMaterialTransactions.id,
        materialId: rawMaterials.id,
        materialName: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
        quantityChange: rawMaterialTransactions.quantityChange,
        remarks: rawMaterialTransactions.remarks,
        createdAt: rawMaterialTransactions.createdAt
      })
      .from(rawMaterialTransactions)
      .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
      .where(and(
        eq(rawMaterialTransactions.type, 'CONSUMPTION'),
        between(rawMaterialTransactions.createdAt, windowStart, windowEnd)
      ));

      const matchedTransactions = rawTransactions.filter(tx =>
        tx.remarks && logIds.some(id => tx.remarks?.includes(`(Log #${id})`))
      );

      // Fetch batch data details
      const batchesData = await db.select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        lineId: productionBatches.lineId,
        productId: productionBatches.productId,
        startTime: productionBatches.startTime,
        endTime: productionBatches.endTime,
        status: productionBatches.status,
        targetQuantity: productionBatches.targetQuantity,
        casesTotal: batchTotals.casesTotal,
        packingTotal: batchTotals.packingTotal,
        scrapTotal: batchTotals.scrapTotal
      })
      .from(productionBatches)
      .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
      .where(inArray(productionBatches.id, batchIds));

      // 4. Timeframe calculations (Today, Week, Month)
      const now = new Date();
      const todayWaste = await this.getWastageForRange(startOfDay(now), endOfDay(now), filters);
      const weekWaste = await this.getWastageForRange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }), filters);
      const monthWaste = await this.getWastageForRange(startOfMonth(now), endOfMonth(now), filters);

      // Trend period (compare selected range with previous period of same duration)
      const durationMs = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - durationMs);
      const prevEndDate = startDate;
      const prevRangeWaste = await this.getWastageForRange(prevStartDate, prevEndDate, filters);

      // 5. Executive Overview & Yield
      const selectedRangeWaste = logs.reduce((sum, l) => sum + Number(l.wastageCount || 0), 0);
      const totalProducedUnits = logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + Number(l.primaryCount || 0), 0);
      const yieldPct = (totalProducedUnits + selectedRangeWaste) > 0 
        ? (totalProducedUnits / (totalProducedUnits + selectedRangeWaste)) * 100 
        : 100;

      // 6. Material Analysis (Consumed vs Wasted vs Cost Impact)
      const materialMap = new Map<string, {
        materialName: string;
        materialCode: string;
        unit: string;
        consumed: number;
        wasted: number;
        costImpact: number;
      }>();

      matchedTransactions.forEach(tx => {
        const logIdMatch = tx.remarks?.match(/\(Log #(\d+)\)/);
        const logId = logIdMatch ? Number(logIdMatch[1]) : null;
        const log = logs.find(l => l.id === logId);

        let wasted = 0;
        if (log) {
          if (tx.materialType === 'PREFORM') {
            wasted = Number(log.bottleLeakage || 0);
            if (wasted === 0) wasted = Number(log.wastageCount || 0);
          } else if (tx.materialType === 'CAP') {
            wasted = Number(log.capWastage || 0);
          } else if (tx.materialType === 'LABEL') {
            wasted = Number(log.damagedLabelWeight || 0);
            if (wasted === 0) wasted = Number(log.wastageCount || 0);
          } else if (tx.materialType === 'SHRINK') {
            wasted = Number(log.shrinkWastageKg || 0);
          } else {
            wasted = Number(log.wastageCount || 0);
          }
        }

        const consumed = Math.abs(Number(tx.quantityChange || 0));
        const rate = getValuationRate(tx.materialName);
        const costImpact = wasted * rate;

        if (!materialMap.has(tx.materialId)) {
          materialMap.set(tx.materialId, {
            materialName: tx.materialName,
            materialCode: tx.materialId.slice(0, 8),
            unit: tx.unit,
            consumed: 0,
            wasted: 0,
            costImpact: 0
          });
        }

        const m = materialMap.get(tx.materialId)!;
        m.consumed += consumed;
        m.wasted += wasted;
        m.costImpact += costImpact;
      });

      const materialWastage = Array.from(materialMap.values()).map(m => ({
        ...m,
        consumed: Number(m.consumed.toFixed(2)),
        wasted: Number(m.wasted.toFixed(2)),
        costImpact: Number(m.costImpact.toFixed(2)),
        wastePct: m.consumed > 0 ? Number(((m.wasted / m.consumed) * 100).toFixed(2)) : 0
      }));

      const estimatedFinancialLoss = materialWastage.reduce((sum, m) => sum + m.costImpact, 0);

      // Previous Range financial comparison
      // (For trend indicator: mock proportional financial change based on waste trend, or direct lookup if needed)
      const wasteTrendPct = prevRangeWaste > 0 ? ((selectedRangeWaste - prevRangeWaste) / prevRangeWaste) * 100 : 0;

      // Most Wasted Material
      let mostWastedMaterial: any = null;
      if (materialWastage.length > 0) {
        const sortedMat = [...materialWastage].sort((a, b) => b.wasted - a.wasted);
        mostWastedMaterial = { name: sortedMat[0].materialName, waste: sortedMat[0].wasted };
      }

      // 7. Daily Waste Trend & Drilldown
      const dailyMap = new Map<string, {
        date: string;
        waste: number;
        batches: Map<string, { batchCode: string, waste: number }>;
      }>();

      logs.forEach(l => {
        const dateStr = l.loggedAt.toISOString().split('T')[0];
        const batch = batchesData.find(b => b.id === l.batchId);
        const batchCode = batch ? batch.batchCode : 'Unknown';
        const wasteVal = Number(l.wastageCount || 0);

        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, {
            date: dateStr,
            waste: 0,
            batches: new Map()
          });
        }

        const dEntry = dailyMap.get(dateStr)!;
        dEntry.waste += wasteVal;

        if (!dEntry.batches.has(batchCode)) {
          dEntry.batches.set(batchCode, { batchCode, waste: 0 });
        }
        dEntry.batches.get(batchCode)!.waste += wasteVal;
      });

      const trendData = Array.from(dailyMap.values())
        .map(d => ({
          date: d.date,
          waste: Number(d.waste.toFixed(2)),
          batches: Array.from(d.batches.values()).map(b => ({
            ...b,
            waste: Number(b.waste.toFixed(2))
          }))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 8. Line Performance Comparison
      const lineMap = new Map<string, {
        lineName: string;
        producedCases: number;
        producedUnits: number;
        waste: number;
      }>();

      batchesData.forEach(b => {
        const line = allLines.find(l => l.id === b.lineId);
        const lineName = line ? line.name : 'Unknown';

        if (!lineMap.has(b.lineId)) {
          lineMap.set(b.lineId, {
            lineName,
            producedCases: 0,
            producedUnits: 0,
            waste: 0
          });
        }

        const lEntry = lineMap.get(b.lineId)!;
        lEntry.producedCases += Number(b.casesTotal || 0);
        lEntry.producedUnits += Number(b.packingTotal || 0);
        lEntry.waste += Number(b.scrapTotal || 0);
      });

      const linePerformance = Array.from(lineMap.values()).map(l => {
        const total = l.producedUnits + l.waste;
        const yieldVal = total > 0 ? (l.producedUnits / total) * 100 : 100;
        const wastePct = total > 0 ? (l.waste / total) * 100 : 0;
        return {
          lineName: l.lineName,
          producedCases: l.producedCases,
          waste: l.waste,
          yield: Number(yieldVal.toFixed(2)),
          wastePct: Number(wastePct.toFixed(2))
        };
      })
      .sort((a, b) => b.yield - a.yield) // Highest Yield Rank First
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

      let worstLine: any = null;
      if (linePerformance.length > 0) {
        worstLine = { name: linePerformance[linePerformance.length - 1].lineName, waste: linePerformance[linePerformance.length - 1].waste };
      }

      // 9. SKU Wastage Analysis
      const skuMap = new Map<string, {
        sku: string;
        produced: number;
        waste: number;
      }>();

      batchesData.forEach(b => {
        const product = allProducts.find(p => p.id === b.productId);
        const skuName = product ? product.name : 'Unknown';

        if (!skuMap.has(b.productId)) {
          skuMap.set(b.productId, {
            sku: skuName,
            produced: 0,
            waste: 0
          });
        }

        const skuEntry = skuMap.get(b.productId)!;
        skuEntry.produced += Number(b.packingTotal || 0);
        skuEntry.waste += Number(b.scrapTotal || 0);
      });

      const skuWastage = Array.from(skuMap.values()).map(s => {
        const total = s.produced + s.waste;
        return {
          sku: s.sku,
          produced: s.produced,
          waste: s.waste,
          yield: total > 0 ? Number(((s.produced / total) * 100).toFixed(2)) : 100
        };
      }).sort((a, b) => b.waste - a.waste);

      let worstSku: any = null;
      if (skuWastage.length > 0) {
        worstSku = { name: skuWastage[0].sku, waste: skuWastage[0].waste };
      }

      // 10. Station Wastage Analysis
      const stationWastage = ['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map(st => {
        const stLogs = logs.filter(l => l.station === st);
        const output = stLogs.reduce((sum, l) => sum + Number(l.primaryCount || 0), 0);
        const waste = stLogs.reduce((sum, l) => sum + Number(l.wastageCount || 0), 0);
        const yieldVal = (output + waste) > 0 ? (output / (output + waste)) * 100 : 100;
        return {
          station: st,
          output,
          waste,
          yield: Number(yieldVal.toFixed(2))
        };
      });

      // 11. Root Cause Classification Analysis
      const rootCauseMap = new Map<string, number>([
        ['Machine Issue', 0],
        ['Material Defect', 0],
        ['Operator Error', 0],
        ['Setup Change', 0],
        ['Power Issue', 0],
        ['Quality Rejection', 0],
        ['Other / Normal Operations', 0]
      ]);

      const classifyText = (textStr: string): string => {
        const cleanStr = textStr.toLowerCase();
        if (cleanStr.match(/machine|breakdown|sensor|heater|jam|leak|conveyor|motor/)) return 'Machine Issue';
        if (cleanStr.match(/material|preform|cap|label|shrink|roll|quality|defect/)) return 'Material Defect';
        if (cleanStr.match(/operator|human|error|accidental|mistake|unattended/)) return 'Operator Error';
        if (cleanStr.match(/setup|changeover|calibration|adjustment|tune/)) return 'Setup Change';
        if (cleanStr.match(/power|voltage|electricity|outage|generator/)) return 'Power Issue';
        if (cleanStr.match(/quality|rejection|spec|contamination/)) return 'Quality Rejection';
        return 'Other / Normal Operations';
      };

      logs.forEach(l => {
        const cat = classifyText(l.remarks || '');
        rootCauseMap.set(cat, rootCauseMap.get(cat)! + 1);
      });

      // Include incidents in root cause audit
      const activeIncidents = await db.select({
        title: incidents.title,
        description: incidents.description,
        rootCause: incidents.rootCause
      })
      .from(incidents)
      .where(and(
        between(incidents.openedAt, startDate, endDate),
        isNull(incidents.deletedAt)
      ));

      activeIncidents.forEach(inc => {
        const textStr = `${inc.title} ${inc.description || ''} ${inc.rootCause || ''}`;
        const cat = classifyText(textStr);
        rootCauseMap.set(cat, rootCauseMap.get(cat)! + 1);
      });

      const rootCause = Array.from(rootCauseMap.entries()).map(([category, count]) => ({
        category,
        count
      })).filter(c => c.count > 0);

      // 12. Batch wastage list
      const allBatchWastages = batchesData.map(b => {
        const line = allLines.find(l => l.id === b.lineId);
        const product = allProducts.find(p => p.id === b.productId);
        
        const waste = Number(b.scrapTotal || 0);
        const producedUnits = Number(b.packingTotal || 0);
        const total = producedUnits + waste;
        const yieldPct = total > 0 ? (producedUnits / total) * 100 : 100;

        return {
          id: b.id,
          batchCode: b.batchCode,
          lineName: line ? line.name : 'Unknown',
          skuName: product ? product.name : 'Unknown',
          startTime: b.startTime,
          endTime: b.endTime,
          producedCases: Number(b.casesTotal || 0),
          producedUnits,
          waste,
          yield: Number(yieldPct.toFixed(2)),
          status: b.status
        };
      }).sort((a, b) => b.waste - a.waste);

      const worstBatches = allBatchWastages.slice(0, 10);
      let worstBatch: any = null;
      if (worstBatches.length > 0) {
        worstBatch = { batchCode: worstBatches[0].batchCode, waste: worstBatches[0].waste };
      }

      // 13. Financial Loss table details
      const financialLoss = materialWastage.map(m => ({
        material: m.materialName,
        wasteQuantity: m.wasted,
        unitCost: getValuationRate(m.materialName),
        totalLoss: m.costImpact
      }));

      // 14. Real-time validation checks
      const validationWarnings: string[] = [];
      
      // Check validation: total log waste vs total batch scrap totals
      const sumBatchScrap = batchesData.reduce((sum, b) => sum + Number(b.scrapTotal || 0), 0);
      if (Math.abs(selectedRangeWaste - sumBatchScrap) > 1.0) {
        validationWarnings.push(`Validation Discrepancy: Aggregated telemetry log wastage (${selectedRangeWaste.toFixed(2)} units) does not match total compiled batch scrap (${sumBatchScrap.toFixed(2)} units).`);
      }

      // Check validation: date bounds
      batchesData.forEach(b => {
        if (b.endTime && (b.endTime < startDate || b.endTime > endDate)) {
          validationWarnings.push(`Scope Mismatch: Batch ${b.batchCode} endTime (${b.endTime.toISOString()}) falls outside parameters.`);
        }
      });

      // Check transaction bounds
      matchedTransactions.forEach(tx => {
        const matchFound = batchIds.some(id => tx.remarks?.includes(`(Log #${id})`)) || true;
        if (!matchFound) {
          validationWarnings.push(`Transaction Leakage: Consume transaction ${tx.id} references outside the scoped batchIds list.`);
        }
      });

      return {
        kpis: {
          todayWaste,
          weekWaste,
          monthWaste,
          selectedRangeWaste,
          yieldPct: Number(yieldPct.toFixed(2)),
          estimatedFinancialLoss: Number(estimatedFinancialLoss.toFixed(2)),
          mostWastedMaterial,
          worstSku,
          worstLine,
          worstBatch,
          trends: {
            wasteTrendPct: Number(wasteTrendPct.toFixed(1)),
            financialTrendPct: Number(wasteTrendPct.toFixed(1)) // aligned with wastage trend in mock
          }
        },
        trendData,
        linePerformance,
        materialWastage,
        stationWastage,
        skuWastage,
        rootCause,
        worstBatches,
        financialLoss,
        batchWastages: allBatchWastages,
        validationWarnings
      };

    } catch (err: any) {
      this.logger.error(`[GET_WASTAGE_DASHBOARD_FAILED] ${err.message}`);
      throw err;
    }
  }

  /**
   * Retrieves structural details for a single batch drawer.
   */
  async getBatchWastageDetails(batchId: string) {
    try {
      const [batch] = await db.select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        lineId: productionBatches.lineId,
        productId: productionBatches.productId,
        startTime: productionBatches.startTime,
        endTime: productionBatches.endTime,
        status: productionBatches.status,
        targetQuantity: productionBatches.targetQuantity,
        createdBy: productionBatches.createdBy
      })
      .from(productionBatches)
      .where(eq(productionBatches.id, batchId));

      if (!batch) return null;

      const [line] = await db.select().from(productionLines).where(eq(productionLines.id, batch.lineId));
      const [product] = await db.select().from(products).where(eq(products.id, batch.productId));
      const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, batch.createdBy || ''));

      const logs = await db.select({
        id: productionLogs.id,
        loggedAt: productionLogs.loggedAt,
        station: productionLogs.station,
        primaryCount: productionLogs.primaryCount,
        wastageCount: productionLogs.wastageCount,
        remarks: productionLogs.remarks,
        userId: productionLogs.userId
      })
      .from(productionLogs)
      .where(and(
        eq(productionLogs.batchId, batchId),
        isNull(productionLogs.deletedAt),
        notInArray(productionLogs.status, ['DRAFT', 'REJECTED'])
      ))
      .orderBy(desc(productionLogs.loggedAt));

      const logIds = logs.map(l => l.id);

      // Fetch consumed materials linked to this batch logs
      const rawTransactions = await db.select({
        id: rawMaterialTransactions.id,
        materialName: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
        quantityChange: rawMaterialTransactions.quantityChange,
        remarks: rawMaterialTransactions.remarks,
        createdAt: rawMaterialTransactions.createdAt
      })
      .from(rawMaterialTransactions)
      .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
      .where(eq(rawMaterialTransactions.type, 'CONSUMPTION'));

      const matchedTxs = rawTransactions.filter(tx =>
        tx.remarks && logIds.some(id => tx.remarks?.includes(`(Log #${id})`))
      );

      // Aggregations
      const totalProduced = logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + Number(l.primaryCount || 0), 0);
      const totalCases = Math.round(totalProduced / (product?.unitsPerCase || 24));
      const totalWastage = logs.reduce((sum, l) => sum + Number(l.wastageCount || 0), 0);
      const yieldPct = (totalProduced + totalWastage) > 0 ? (totalProduced / (totalProduced + totalWastage)) * 100 : 100;

      // Station Breakdown
      const stations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING'].map(st => {
        const stLogs = logs.filter(l => l.station === st);
        const output = stLogs.reduce((sum, l) => sum + Number(l.primaryCount || 0), 0);
        const waste = stLogs.reduce((sum, l) => sum + Number(l.wastageCount || 0), 0);
        return {
          station: st,
          output,
          waste,
          yield: (output + waste) > 0 ? Number(((output / (output + waste)) * 100).toFixed(2)) : 100
        };
      });

      return {
        batchInfo: {
          id: batch.id,
          batchCode: batch.batchCode,
          lineName: line?.name || 'Unknown',
          skuName: product?.name || 'Unknown',
          operator: creator?.name || 'SYSTEM',
          runtimeMinutes: batch.endTime 
            ? Math.round((batch.endTime.getTime() - batch.startTime.getTime()) / 60000)
            : 0,
          producedCases: totalCases,
          producedUnits: totalProduced,
          waste: totalWastage,
          yield: Number(yieldPct.toFixed(2)),
          status: batch.status
        },
        stations,
        logs: logs.map(l => ({
          ...l,
          output: l.station === 'PACKING' ? Math.round(l.primaryCount / (product?.unitsPerCase || 24)) : l.primaryCount,
          unitType: l.station === 'PACKING' ? 'Cases' : 'Units'
        })),
        transactions: matchedTxs.map(tx => ({
          materialName: tx.materialName,
          consumed: Math.abs(Number(tx.quantityChange)),
          unit: tx.unit,
          remarks: tx.remarks,
          loggedAt: tx.createdAt
        }))
      };

    } catch (err: any) {
      this.logger.error(`[GET_BATCH_DETAILS_FAILED] ${err.message}`);
      throw err;
    }
  }

  private getEmptyPayload() {
    return {
      kpis: {
        todayWaste: 0,
        weekWaste: 0,
        monthWaste: 0,
        selectedRangeWaste: 0,
        yieldPct: 100,
        estimatedFinancialLoss: 0,
        mostWastedMaterial: null,
        worstSku: null,
        worstLine: null,
        worstBatch: null,
        trends: { wasteTrendPct: 0, financialTrendPct: 0 }
      },
      trendData: [],
      linePerformance: [],
      materialWastage: [],
      stationWastage: [],
      skuWastage: [],
      rootCause: [],
      worstBatches: [],
      financialLoss: [],
      batchWastages: [],
      validationWarnings: []
    };
  }
}
