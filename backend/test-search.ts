import { db } from './src/database/db';
import { sql } from 'drizzle-orm';
import { productionLogs, batchTotals } from './src/database/schema';

async function test() {
  console.log('Searching for 13223, 28945, 827 in batchTotals...');
  const res = await db.execute(sql`
    select * from batch_totals 
    where cases_total in (13223, 28945, 827)
       or finished_goods_total in (13223, 28945, 827)
       or packing_total in (13223, 28945, 827)
       or blowing_total in (13223, 28945, 827)
       or filling_total in (13223, 28945, 827)
  `);
  console.log('batch_totals:', res);

  console.log('Searching in production_logs...');
  const res2 = await db.execute(sql`
    select id, batch_id, station, primary_count, cases_produced, finished_goods_produced
    from production_logs 
    where primary_count in (13223, 28945, 827)
       or cases_produced in (13223, 28945, 827)
       or finished_goods_produced in (13223, 28945, 827)
  `);
  console.log('production_logs:', res2);
}
test().catch(console.error).then(() => process.exit(0));
