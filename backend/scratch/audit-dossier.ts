import { db } from './src/database';
import { productionBatches, productionLogs, productionLines, batchTotals } from './src/database/schema';
import { eq, between, and } from 'drizzle-orm';

async function main() {
  const line = await db.query.productionLines.findFirst({
    where: eq(productionLines.name, 'Line 1')
  });
  if (!line) return console.log('Line 1 not found');

  const startDate = new Date('2026-06-08T00:00:00Z');
  const endDate = new Date('2026-06-15T23:59:59Z');

  // 1. Logs in date range
  const logs = await db.select().from(productionLogs)
    .where(and(
      eq(productionLogs.lineId, line.id),
      between(productionLogs.loggedAt, startDate, endDate)
    ));
    
  let logPacking = 0;
  let logBlowing = 0;
  logs.forEach(l => {
     if (l.station === 'PACKING') logPacking += Number(l.primaryCount);
     if (l.station === 'BLOWING') logBlowing += Number(l.primaryCount);
  });

  // 2. Batches completed in date range
  const batches = await db.select().from(productionBatches)
    .where(and(
      eq(productionBatches.lineId, line.id),
      between(productionBatches.createdAt, startDate, endDate)
    ));

  let batchTotalCases = 0;
  let batchTotalBlowing = 0;
  let batchTotalPacking = 0;

  for (const b of batches) {
     batchTotalCases += Number(b.casesTotal || 0);
     const totals = await db.select().from(batchTotals).where(eq(batchTotals.batchId, b.id));
     const blow = totals.find(t => t.station === 'BLOWING');
     const pack = totals.find(t => t.station === 'PACKING');
     if (blow) batchTotalBlowing += Number(blow.totalOutput || 0);
     if (pack) batchTotalPacking += Number(pack.totalOutput || 0);
  }

  console.log(`--- LOGS IN DATE RANGE ---`);
  console.log(`Logs Count: ${logs.length}`);
  console.log(`Logs Blowing Output: ${logBlowing}`);
  console.log(`Logs Packing Output: ${logPacking}`);
  
  console.log(`\n--- BATCHES IN DATE RANGE ---`);
  console.log(`Batches Count: ${batches.length}`);
  console.log(`Batches Total Cases: ${batchTotalCases}`);
  console.log(`Batches Total Blowing Output: ${batchTotalBlowing}`);
  console.log(`Batches Total Packing Output: ${batchTotalPacking}`);

}

main().catch(console.error).finally(() => process.exit(0));
