import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function testQuery() {
  try {
    const startDateStr = '2026-08-01';
    const endDateStr = '2026-09-01';
    const dateWhere = sql`date(pl.logged_at) >= ${startDateStr}::date AND date(pl.logged_at) < ${endDateStr}::date`;

    const res = await db.execute(sql`
      SELECT
        coalesce(sum(coalesce(pl.cases_produced, pl.primary_count, 0)), 0)::int as total_cases_produced,
        coalesce(sum(coalesce(pl.wastage_count, 0)), 0)::int as total_wastage,
        count(pl.id)::int as log_count
      FROM production_logs pl
      JOIN production_batches pb ON pb.id = pl.batch_id AND pb.deleted_at IS NULL
      WHERE pb.deleted_at IS NULL AND pl.station = 'PACKING' AND ${dateWhere}
    `);
    console.log('Query success:', res);
  } catch (e: any) {
    console.error('FULL ERROR STACK:', e);
  }
}

testQuery();
