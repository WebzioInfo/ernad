import { db } from '../src/database/db';
import { inventoryLedger, productionLogs, productionBatches } from '../src/database/schema';
import { eq, and, sql } from 'drizzle-orm';

async function test() {
  console.log("Checking logs and ledger relations...");

  // Get a few logs with batchId
  const logs = await db.select({
    id: productionLogs.id,
    batchId: productionLogs.batchId,
    station: productionLogs.station
  }).from(productionLogs).limit(5);

  console.log("Sample Production Logs:", logs);

  const batchIds = [...new Set(logs.map(l => l.batchId).filter(Boolean))];
  console.log("Batch IDs from those logs:", batchIds);

  if (batchIds.length > 0) {
    const ledgerEntries = await db.select({
      id: inventoryLedger.id,
      batchId: inventoryLedger.batchId,
      type: inventoryLedger.type,
      qty: inventoryLedger.quantityChange
    })
    .from(inventoryLedger)
    .where(sql`${inventoryLedger.batchId} IN (${sql.join(batchIds.map(b => sql`${b}`), sql`,`)})`);
    
    console.log(`Found ${ledgerEntries.length} ledger entries for these batches.`);
    console.log("Sample Ledger Entries:", ledgerEntries.slice(0, 5));

    const consumptions = await db.select({
      type: inventoryLedger.type,
      count: sql`count(*)`,
    }).from(inventoryLedger).groupBy(inventoryLedger.type);

    console.log("All ledger types:", consumptions);
  }

  process.exit(0);
}

test().catch(console.error);
