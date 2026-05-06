import { db } from '../src/db/db';
import { productionBatches, productionLogs, operatorSessions, batchTotals } from '../src/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';

async function auditBatchIntegrity() {
  console.log('--- STARTING BATCH SYSTEM INTEGRITY AUDIT ---');

  // 1. Find batches with empty or NULL batch codes
  const emptyBatches = await db.select().from(productionBatches).where(sql`${productionBatches.batchCode} IS NULL OR ${productionBatches.batchCode} = ''`);
  console.log(`[AUDIT] Batches with empty/NULL batchCode: ${emptyBatches.length}`);
  emptyBatches.forEach(b => console.log(`  - ID: ${b.id}, Line: ${b.lineId}, Created: ${b.createdAt}`));

  // 2. Find orphaned production logs (logs with batchId that doesn't exist)
  const orphanedLogs = await db.execute(sql`
    SELECT count(*) FROM production_logs pl 
    LEFT JOIN production_batches pb ON pl.batch_id = pb.id 
    WHERE pb.id IS NULL
  `);
  console.log(`[AUDIT] Orphaned Production Logs: ${orphanedLogs[0].count}`);

  // 3. Find orphaned operator sessions
  const orphanedSessions = await db.execute(sql`
    SELECT count(*) FROM operator_sessions os 
    LEFT JOIN production_batches pb ON os.batch_id = pb.id 
    WHERE os.batch_id IS NOT NULL AND pb.id IS NULL
  `);
  console.log(`[AUDIT] Orphaned Operator Sessions: ${orphanedSessions[0].count}`);

  // 4. Find batches missing atomic totals
  const missingTotals = await db.execute(sql`
    SELECT count(*) FROM production_batches pb 
    LEFT JOIN batch_totals bt ON pb.id = bt.batch_id 
    WHERE bt.batch_id IS NULL
  `);
  console.log(`[AUDIT] Batches missing BatchTotals entry: ${missingTotals[0].count}`);

  // 5. Detect duplicate batch codes (if unique constraint was missing)
  const duplicates = await db.execute(sql`
    SELECT batch_code, count(*) FROM production_batches 
    GROUP BY batch_code HAVING count(*) > 1
  `);
  console.log(`[AUDIT] Duplicate Batch Codes found: ${duplicates.length}`);
  duplicates.forEach((d: any) => console.log(`  - Code: ${d.batch_code}, Count: ${d.count}`));

  console.log('--- AUDIT COMPLETE ---');
}

auditBatchIntegrity().catch(console.error);
