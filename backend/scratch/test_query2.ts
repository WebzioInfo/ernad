import 'dotenv/config';
import { db } from '../src/database/db';
import { productionBatches } from '../src/database/schema';
import { eq, and, or } from 'drizzle-orm';

async function main() {
  try {
    const result = await db.select()
      .from(productionBatches)
      .where(and(
        eq(productionBatches.lineId, '3fe1ebd4-8d6f-41d7-baf9-9515f4019a27'),
        or(
          eq(productionBatches.status, 'RUNNING'),
          eq(productionBatches.status, 'CHANGEOVER')
        )
      ))
      .limit(1);
    console.log('success:', result.length);
  } catch (e: any) {
    console.error('DB ERROR:', e.message);
  }
  process.exit(0);
}
main();
