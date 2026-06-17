import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function check() {
  const res = await db.execute(sql`
    SELECT id, type, quantity_change, remarks FROM raw_material_transactions
    WHERE remarks LIKE '%Log #112%'
  `);
  console.log(res);
  process.exit(0);
}
check();
