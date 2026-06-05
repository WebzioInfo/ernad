import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function main() {
  const sums = await db.execute(sql`
    SELECT
      sum(primary_count) as total_primary,
      sum(cases_produced) as total_cases,
      sum(finished_goods_produced) as total_finished_goods,
      sum(secondary_packaging_count) as total_secondary
    FROM production_logs
    WHERE station = 'PACKING' AND deleted_at IS NULL
  `);
  console.log('Production Log Sums:', sums);

  process.exit(0);
}

main().catch(console.error);
