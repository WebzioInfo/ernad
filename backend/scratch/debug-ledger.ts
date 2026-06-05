import { db } from '../src/database/db';
import * as schema from '../src/database/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function debugLedger(batchCode: string) {
  const [batch] = await db.select().from(schema.productionBatches).where(eq(schema.productionBatches.batchCode, batchCode));
  if (!batch) return console.log('Batch not found');

  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, batch.productId));
  
  const logs = await db.select().from(schema.productionLogs).where(eq(schema.productionLogs.batchId, batch.id));
  const blowingOutput = logs.filter(l => l.station === 'BLOWING').reduce((sum, l) => sum + (l.primaryCount || 0), 0);
  const fillingOutput = logs.filter(l => l.station === 'FILLING').reduce((sum, l) => sum + (l.primaryCount || 0), 0);
  const labelingOutput = logs.filter(l => l.station === 'LABELING').reduce((sum, l) => sum + (l.primaryCount || 0), 0);
  const packingOutput = logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + (l.primaryCount || 0), 0);
  
  const packingCases = logs.filter(l => l.station === 'PACKING').reduce((sum, l) => sum + (l.casesProduced || 0), 0);
  const finishedGoodsAdded = logs.reduce((sum, l) => sum + (l.finishedGoodsProduced || 0), 0);

  const calculatedCases = Math.floor(packingOutput / (product.unitsPerCase || 1));

  console.log(`=== BATCH ${batchCode} DATA ===`);
  console.log(`Product: ${product.name}`);
  console.log(`unitsPerCase: ${product.unitsPerCase}`);
  console.log(`blowingOutput: ${blowingOutput}`);
  console.log(`fillingOutput: ${fillingOutput}`);
  console.log(`labelingOutput: ${labelingOutput}`);
  console.log(`packingOutput (Units): ${packingOutput}`);
  console.log(`packingCases (productionLogs.casesProduced): ${packingCases}`);
  console.log(`finishedGoodsAdded (productionLogs.finishedGoodsProduced): ${finishedGoodsAdded}`);
  console.log(`calculatedCases (packingOutput / unitsPerCase): ${calculatedCases}`);

  console.log(`\nDIVERGENCE ANALYSIS:`);
  console.log(`The value 827 comes from: productionLogs.casesProduced (Manual entry from packing station)`);
  console.log(`The value 1206 comes from: calculatedCases (${packingOutput} / ${product.unitsPerCase})`);
}

debugLedger('EB26155').catch(console.error).then(() => process.exit(0));
