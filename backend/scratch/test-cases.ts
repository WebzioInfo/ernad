import { db } from '../src/database/db';
import * as schema from '../src/database/schema';
import { eq, sql, inArray, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function debugBatch(batchCode: string) {
  console.log(`\n================================`);
  console.log(`DEBUGGING BATCH: ${batchCode}`);
  console.log(`================================`);

  const batch = await db.select().from(schema.productionBatches).where(eq(schema.productionBatches.batchCode, batchCode));
  if (!batch.length) {
    console.log('Batch not found');
    return;
  }

  const b = batch[0];
  console.log(`Batch ID: ${b.id}`);

  const product = await db.select().from(schema.products).where(eq(schema.products.id, b.productId));
  const unitsPerCase = product[0].unitsPerCase;
  console.log(`Product: ${product[0].name}`);
  console.log(`Units Per Case: ${unitsPerCase}`);

  // 1. Output from logs (Production Reports calculation)
  const logs = await db.select().from(schema.productionLogs).where(eq(schema.productionLogs.batchId, b.id));
  const packingLogs = logs.filter(l => l.station === 'PACKING');
  
  const producedUnitsLogs = packingLogs.reduce((sum, l) => sum + (l.primaryCount || 0), 0);
  const calculatedCases = Math.floor(producedUnitsLogs / (unitsPerCase || 1));
  const storedCasesLogs = packingLogs.reduce((sum, l) => sum + (l.casesProduced || 0), 0);

  console.log(`\n--- PRODUCTION LOGS ---`);
  console.log(`Produced Units (primaryCount): ${producedUnitsLogs}`);
  console.log(`Calculated Cases (Units / UPC): ${calculatedCases}`);
  console.log(`Stored Cases (casesProduced): ${storedCasesLogs}`);

  // 2. Batch Totals (Manager Batch Details calculation)
  const totals = await db.select().from(schema.batchTotals).where(eq(schema.batchTotals.batchId, b.id));
  console.log(`\n--- BATCH TOTALS TABLE ---`);
  if (totals.length) {
    console.log(`Blowing Total: ${totals[0].blowingTotal}`);
    console.log(`Filling Total: ${totals[0].fillingTotal}`);
    console.log(`Labeling Total: ${totals[0].labelingTotal}`);
    console.log(`Packing Total: ${totals[0].packingTotal}`);
    console.log(`Calculated Cases from Totals: ${Math.floor((totals[0].packingTotal || 0) / (unitsPerCase || 1))}`);
  } else {
    console.log(`No totals found`);
  }

  const fg = await db.select().from(schema.finishedGoodsInventory).where(eq(schema.finishedGoodsInventory.productId, b.productId));
  const fgCases = fg.reduce((sum, f) => sum + Number(f.quantity || 0), 0);
  console.log(`\n--- FINISHED GOODS INVENTORY TABLE ---`);
  console.log(`Stored Quantity for Product (Cases): ${fgCases}`);
  
}

debugBatch('EB26155').catch(console.error).then(() => process.exit(0));
