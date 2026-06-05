import * as fs from 'fs';
import * as path from 'path';

const file = 'c:/Users/siinaan/Desktop/ernad/backend/src/modules/reports/reports.service.ts';
let code = fs.readFileSync(file, 'utf-8');

const newMethod = `

  async getOperationsLedgerReport(filters: { startDate: Date; endDate: Date }) {
    try {
      const { startDate, endDate } = filters;
      
      const reportData = await this.getProductionReport({ startDate, endDate });
      const batchesData = await this.getProductionBatches({ startDate, endDate });

      // Raw Material Consumption
      const materialConsumption = await db.select({
        materialId: rawMaterials.id,
        materialName: rawMaterials.name,
        unit: rawMaterials.unit,
        currentStock: rawMaterials.currentStock,
        consumed: sql<number>\`ABS(SUM(\${rawMaterialTransactions.quantityChange}))\`
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
        id: inventoryLedger.id,
        productName: products.name,
        cases: sql<number>\`ABS(\${inventoryLedger.quantityChange})\`,
        date: inventoryLedger.createdAt,
        reference: inventoryLedger.referenceId,
        destination: inventoryLedger.remarks // Assuming destination is in remarks or reference
      })
      .from(inventoryLedger)
      .leftJoin(products, eq(inventoryLedger.productId, products.id))
      .where(and(
        eq(inventoryLedger.type, 'DISPATCH'),
        between(inventoryLedger.createdAt, startDate, endDate)
      ))
      .orderBy(desc(inventoryLedger.createdAt));

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
        totalLogs: sql<number>\`COUNT(\${productionLogs.id})\`,
        producedUnits: getProducedQuantitySql(),
        producedCases: sql<number>\`COALESCE(SUM(CASE WHEN \${productionLogs.station}::text = 'PACKING' THEN \${productionLogs.casesProduced} ELSE 0 END), 0)\`,
        wastage: getWastageQuantitySql()
      })
      .from(productionLogs)
      .innerJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(productionLines, eq(productionLogs.lineId, productionLines.id))
      .where(between(productionLogs.loggedAt, startDate, endDate))
      .groupBy(users.id, users.name, productionLines.id, productionLines.name)
      .orderBy(desc(getProducedQuantitySql()))
      .limit(10);

      return {
        reportData,
        batchesData,
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
      this.logger.error(\`[GET_OPERATIONS_LEDGER_FAILED] \${error.message}\`);
      throw error;
    }
  }
`;

const insertIndex = code.indexOf('async getBatchDossier');
if (insertIndex !== -1) {
  code = code.slice(0, insertIndex) + newMethod + code.slice(insertIndex);
  fs.writeFileSync(file, code);
  console.log('Successfully inserted getOperationsLedgerReport');
} else {
  console.log('Could not find async getBatchDossier to insert before');
}
