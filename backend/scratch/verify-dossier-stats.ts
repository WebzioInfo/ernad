import { db } from '../src/database';
import { productionLogs, productionLines, products } from '../src/database/schema';
import { eq, between, and } from 'drizzle-orm';

async function main() {
  const line = await db.query.productionLines.findFirst({
    where: eq(productionLines.name, 'Line 1')
  });
  if (!line) return console.log('Line 1 not found');

  const startDate = new Date('2026-06-08');
  const endDate = new Date('2026-06-15');

  const logs = await db.select({
    id: productionLogs.id,
    station: productionLogs.station,
    primaryCount: productionLogs.primaryCount,
    casesProduced: productionLogs.casesProduced,
    productId: productionLogs.productId
  })
  .from(productionLogs)
  .where(and(
    eq(productionLogs.lineId, line.id),
    between(productionLogs.loggedAt, startDate, endDate)
  ));

  const stats = logs.reduce((acc, log) => {
    acc[log.station] = (acc[log.station] || 0) + log.primaryCount;
    acc.cases = (acc.cases || 0) + (log.casesProduced || 0);
    return acc;
  }, {} as any);

  console.log('Stats:', stats);
  console.log('Total Logs:', logs.length);
  
  if (logs.length > 0) {
     const p = await db.query.products.findFirst({
        where: eq(products.id, logs[0].productId as string)
     });
     console.log('Sample Product Units Per Case:', p?.unitsPerCase);
  }
}

main().catch(console.error).finally(() => process.exit(0));
