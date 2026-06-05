import { db } from './src/database/db';
import { sql } from 'drizzle-orm';

async function test() {
  const res = await db.execute(sql`
        select
          date_trunc('day', pl.logged_at) as time,
          coalesce(sum(pl.cases_produced), 0)::int as total_cases,
          coalesce(sum(pl.primary_count), 0)::int as total_output,
          coalesce(sum(case when pl.station = 'PACKING' then pl.cases_produced else 0 end), 0)::int as packing_cases,
          coalesce(sum(case when pl.station = 'PACKING' then pl.primary_count else 0 end), 0)::int as packing_output
        from production_logs pl
        group by 1
        order by 1;
      `);
  console.log('Query result:', res);
}
test().catch(console.error).then(() => process.exit(0));
