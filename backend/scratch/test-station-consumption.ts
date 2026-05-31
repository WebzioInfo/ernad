import { db } from '../src/database/db';
import { productionLogs } from '../src/database/schema';
import { and, isNull, sql } from 'drizzle-orm';

async function test() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log('Querying...');
    const result = await db.select({
      station: productionLogs.station,
      loggedAt: productionLogs.loggedAt
    })
    .from(productionLogs)
    .where(
      and(
        sql`${productionLogs.loggedAt} >= ${thirtyDaysAgo}`,
        isNull(productionLogs.deletedAt)
      )
    );
    console.log('Success:', result.length);
  } catch (err: any) {
    console.error('Error:', err);
  }
}

test().then(() => process.exit(0));
