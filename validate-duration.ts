import { db } from './backend/src/database/db';
import { productionBatches, productionLogs } from './backend/src/database/schema';
import { eq, sql } from 'drizzle-orm';

async function validateBatch() {
  const batchCode = 'EB26161';
  console.log(`Validating batch ${batchCode}...`);

  const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.batchCode, batchCode));

  if (!batch) {
    console.log(`Batch ${batchCode} not found in database. Selecting any completed batch...`);
    const [anyBatch] = await db.select().from(productionBatches).where(eq(productionBatches.status, 'COMPLETED')).limit(1);
    if (!anyBatch) {
      console.log('No completed batches found.');
      process.exit(0);
    }
    Object.assign(batch || {}, anyBatch);
  }

  let startedAt = batch.adjustedStartTime || batch.startTime;
  let endedAt = batch.endTime;

  if (!startedAt || (!endedAt && ['COMPLETED', 'CLOSED'].includes(batch.status))) {
    const logs = await db.select({
      minTime: sql<Date>`MIN(${productionLogs.loggedAt})`,
      maxTime: sql<Date>`MAX(${productionLogs.loggedAt})`
    })
    .from(productionLogs)
    .where(eq(productionLogs.batchId, batch.id));

    if (logs.length > 0) {
      if (!startedAt && logs[0].minTime) {
        startedAt = logs[0].minTime;
        console.log(`Fallback triggered: Used MIN(loggedAt) for batch ${batch.id} start time.`);
      }
      if (!endedAt && ['COMPLETED', 'CLOSED'].includes(batch.status) && logs[0].maxTime) {
        endedAt = logs[0].maxTime;
        console.log(`Fallback triggered: Used MAX(loggedAt) for batch ${batch.id} end time.`);
      }
    }
  }

  let durationMinutes = 0;
  if (startedAt) {
    const endToUse = endedAt || new Date();
    durationMinutes = Math.max(0, Math.round((endToUse.getTime() - startedAt.getTime()) / 60000));
  }

  const durationHours = Math.floor(durationMinutes / 60);
  const days = Math.floor(durationHours / 24);
  const remainingHours = durationHours % 24;
  const remainingMins = durationMinutes % 60;

  let formattedDuration = `${durationMinutes} mins`;
  if (days > 0) {
    formattedDuration = `${days}d ${remainingHours}h ${remainingMins}m`;
  } else if (durationHours > 0) {
    formattedDuration = `${durationHours}h ${remainingMins}m`;
  }

  console.log(`\n--- VALIDATION OUTPUT ---`);
  console.log(`Batch ID: ${batch.id} / ${batch.batchCode}`);
  console.log(`Start Time Source: ${startedAt ? startedAt.toISOString() : 'N/A'}`);
  console.log(`End Time Source: ${endedAt ? endedAt.toISOString() : 'N/A'}`);
  console.log(`Raw Difference (Mins): ${durationMinutes}`);
  console.log(`Formatted Duration: ${formattedDuration}`);
  
  process.exit(0);
}

validateBatch().catch(console.error);
