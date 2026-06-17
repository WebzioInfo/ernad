import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function check() {
  const res = await db.execute(sql`
    SELECT remarks FROM raw_material_transactions
    WHERE remarks LIKE '%Correction % for Log #%'
  `);
  console.log(res);
  process.exit(0);
}
check();
