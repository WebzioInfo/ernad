import { db } from '../src/database/db';
import { productionBatches, batchTotals, productionLogs, productionLines } from '../src/database/schema';
import { eq, and, sql, between, inArray, desc } from 'drizzle-orm';

async function main() {
  const line = await db.query.productionLines.findFirst({
    where: eq(productionLines.name, 'LINE 1')
  });
  if (!line) {
    console.log('LINE 1 not found');
    return;
  }

  const startDate = new Date('2026-06-08T00:00:00Z');
  const endDate = new Date('2026-06-15T23:59:59Z');

  const logs = await db.select()
  .from(productionLogs)
  .where(and(
    eq(productionLogs.lineId, line.id),
    eq(productionLogs.station, 'PACKING'),
    between(productionLogs.loggedAt, startDate, endDate),
    sql`deleted_at IS NULL`
  ))
  .orderBy(productionLogs.loggedAt);

  console.log('=== RAW PACKING LOGS FOR LINE 1 ===');
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
