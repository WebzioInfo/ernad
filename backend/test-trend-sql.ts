import { db } from './src/database/db';
import { sql } from 'drizzle-orm';

async function test() {
  const startIso = '2026-06-01T00:00:00.000Z';
  const res = await db.execute(sql`
        select
          date_trunc('day', pl.logged_at) as time,
          coalesce(sum(case when pl.station = 'PACKING' then coalesce(pl.cases_produced, 0) else 0 end), 0)::int as produced
        from production_logs pl
        where pl.deleted_at is null and pl.logged_at >= ${startIso}
        group by 1
        order by 1;
      `);
  console.log('Query result:', res);
}
test().catch(console.error).then(() => process.exit(0));
