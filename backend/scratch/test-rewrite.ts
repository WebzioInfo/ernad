import { db } from '../src/database';
import { productionBatches, productionLines, products, productBrands, incidents } from '../src/database/schema/production';
import { batchTotals, productionLogs } from '../src/database/schema/logs';
import { eq, between, and, sql, inArray, notInArray, desc } from 'drizzle-orm';
import { users } from '../src/database/schema/users';
import { getProducedQuantitySql, getWastageQuantitySql } from '../src/common/utils/production-metrics.helper';

// Develop new getProductionReport here:
async function getProductionReport(filters: { startDate: Date; endDate: Date; lineId?: string }) {
  const conditions = [
    between(productionBatches.endTime, filters.startDate, filters.endDate),
    inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
    sql`${productionBatches.deletedAt} IS NULL`
  ];
  if (filters.lineId && filters.lineId !== 'all') conditions.push(eq(productionBatches.lineId, filters.lineId));

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

  return results.map(r => {
    const out = Number(r.totalOutput);
    const waste = Number(r.totalWastage);
    const rejectionRate = (out + waste) > 0 ? (waste / (out + waste)) * 100 : 0;
    return {
      ...r,
      totalCases: Number(r.totalCases),
      totalOutput: out,
      totalWastage: waste,
      rejectionRate: Number(rejectionRate.toFixed(2))
    }
  });
}

// Develop new getProductionReportDetails here:
async function getProductionReportDetails(filters: { startDate: Date; endDate: Date; lineId: string; productId?: string }) {
  const conditions = [
    between(productionBatches.endTime, filters.startDate, filters.endDate),
    inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
    sql`${productionBatches.deletedAt} IS NULL`,
    eq(productionBatches.lineId, filters.lineId)
  ];
  if (filters.productId) conditions.push(eq(productionBatches.productId, filters.productId));

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
  .where(and(...conditions))
  .orderBy(desc(productionBatches.endTime));

  let totalCases = 0;
  let totalOutput = 0;
  let totalWastage = 0;
  let blowing = 0, filling = 0, labeling = 0, packing = 0;
  
  batches.forEach(b => {
    totalCases += Number(b.casesTotal || 0);
    totalOutput += Number(b.packingTotal || 0);
    totalWastage += Number(b.scrapTotal || 0);
    blowing += Number(b.blowingTotal || 0);
    filling += Number(b.fillingTotal || 0);
    labeling += Number(b.labelingTotal || 0);
    packing += Number(b.packingTotal || 0);
  });

  const getYield = (out: number, w: number) => (out + w) > 0 ? (out / (out + w)) * 100 : 100;

  const stationAnalysis = [
    { station: 'BLOWING', output: blowing, waste: totalWastage / 4, yieldPct: getYield(blowing, totalWastage / 4) },
    { station: 'FILLING', output: filling, waste: totalWastage / 4, yieldPct: getYield(filling, totalWastage / 4) },
    { station: 'LABELING', output: labeling, waste: totalWastage / 4, yieldPct: getYield(labeling, totalWastage / 4) },
    { station: 'PACKING', output: packing, waste: totalWastage / 4, yieldPct: getYield(packing, totalWastage / 4) }
  ];

  console.log('Dossier Results:');
  console.log({ totalCases, totalOutput, totalWastage, stationAnalysis });
}

async function main() {
  const line = await db.query.productionLines.findFirst({
    where: eq(productionLines.name, 'Line 1')
  });
  if (!line) return console.log('Line 1 not found');
  const d1 = new Date('2026-06-08T00:00:00Z');
  const d2 = new Date('2026-06-15T23:59:59Z');

  console.log('--- getProductionReport ---');
  const r1 = await getProductionReport({ startDate: d1, endDate: d2, lineId: line.id });
  console.log(r1);

  console.log('\n--- getProductionReportDetails ---');
  await getProductionReportDetails({ startDate: d1, endDate: d2, lineId: line.id });
}

main().catch(console.error).finally(() => process.exit(0));
