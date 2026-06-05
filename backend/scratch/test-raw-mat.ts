import { db } from '../src/database/db';
import { rawMaterialTransactions, rawMaterials, productionLogs } from '../src/database/schema';
import { eq, like, sql, inArray } from 'drizzle-orm';

async function test() {
  const tx = await db.select().from(rawMaterialTransactions).limit(10);
  console.log("Sample rawMaterialTransactions:", tx);

  // Check if any remarks have Log #
  const txWithLog = await db.select({
    id: rawMaterialTransactions.id,
    remarks: rawMaterialTransactions.remarks,
    qty: rawMaterialTransactions.quantityChange
  }).from(rawMaterialTransactions).where(like(rawMaterialTransactions.remarks, '%(Log #%'));
  
  console.log(`Found ${txWithLog.length} tx with Log # in remarks`);
  console.log("Sample:", txWithLog.slice(0, 5));

  process.exit(0);
}

test().catch(console.error);
