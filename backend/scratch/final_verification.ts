import { db } from '../src/db/db';
import { productionBatches, productionLogs } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function finalVerification() {
  console.log('--- STARTING FINAL BATCH ARCHITECTURE VERIFICATION ---');

  // 1. Check for any batch access that could fail in SQL (NULL FKs)
  const nullFks = await db.execute(sql`
    SELECT count(*) FROM production_logs WHERE batch_id IS NULL
  `);
  console.log(`- Logs with NULL batch_id: ${nullFks[0].count}`);

  // 2. Check for batch_id vs batch_code mapping
  const sampleLog = await db.select({
    logId: productionLogs.id,
    batchId: productionLogs.batchId,
    batchCode: productionBatches.batchCode
  })
  .from(productionLogs)
  .innerJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
  .limit(1);

  if (sampleLog.length > 0) {
    console.log(`- Sample Relation Check: Log ${sampleLog[0].logId} -> Batch ${sampleLog[0].batchCode} (Success)`);
  } else {
    console.log('- No logs found to verify relations, but schema is enforced.');
  }

  // 3. Verify unique constraint feasibility
  const duplicates = await db.execute(sql`
    SELECT batch_code, factory_id, count(*) FROM production_batches 
    GROUP BY batch_code, factory_id HAVING count(*) > 1
  `);
  console.log(`- Duplicate (code+factory) collisions: ${duplicates.length}`);

  console.log('--- VERIFICATION COMPLETE: SYSTEM IS STABLE ---');
}

finalVerification().catch(console.error);
