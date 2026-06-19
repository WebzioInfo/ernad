import { db } from '../src/database/db';
import { productionBatches, productionLogs, productionLines, batchTotals } from '../src/database/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  console.log('Querying batch EB26169 details...');

  const batches = await db.select({
    id: productionBatches.id,
    batchCode: productionBatches.batchCode,
    lineId: productionBatches.lineId,
    lineName: productionLines.name,
    status: productionBatches.status,
    targetQuantity: productionBatches.targetQuantity
  })
  .from(productionBatches)
  .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
  .where(eq(productionBatches.batchCode, 'EB26169'));

  console.log('Production Batches found:', batches);

  for (const batch of batches) {
    console.log(`\n=== Batch ID: ${batch.id} | Line: ${batch.lineName} ===`);
    
    // Totals in batchTotals
    const [totals] = await db.select().from(batchTotals).where(eq(batchTotals.batchId, batch.id));
    console.log('Batch Totals Row:', totals);

    // Sum of approved packing logs
    const packingLogs = await db.select()
      .from(productionLogs)
      .where(and(
        eq(productionLogs.batchId, batch.id),
        eq(productionLogs.station, 'PACKING'),
        eq(productionLogs.status, 'VERIFIED') // or not in DRAFT/REJECTED
      ));
    console.log(`Packing logs count: ${packingLogs.length}`);
    const sumPackingPrimary = packingLogs.reduce((acc, l) => acc + Number(l.primaryCount || 0), 0);
    const sumPackingCases = packingLogs.reduce((acc, l) => acc + Number(l.casesProduced || 0), 0);
    console.log(`Sum Packing Primary: ${sumPackingPrimary}, Sum Packing Cases: ${sumPackingCases}`);

    // All logs grouped by station and operator
    const stationLogs = await db.select({
      id: productionLogs.id,
      station: productionLogs.station,
      primaryCount: productionLogs.primaryCount,
      casesProduced: productionLogs.casesProduced,
      wastageCount: productionLogs.wastageCount,
      lineId: productionLogs.lineId,
      status: productionLogs.status,
      deletedAt: productionLogs.deletedAt
    })
    .from(productionLogs)
    .where(eq(productionLogs.batchId, batch.id));
    
    console.log(`Total logs in batchId: ${stationLogs.length}`);
    // Check if any log has a mismatched lineId
    const mismatchLine = stationLogs.filter(l => l.lineId !== batch.lineId);
    if (mismatchLine.length > 0) {
      console.log('WARNING: LOGS WITH MISMATCHED LINE ID DETECTED!', mismatchLine);
    } else {
      console.log('All logs have matching lineId.');
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
