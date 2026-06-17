import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function check() {
  const res = await db.execute(sql`
    SELECT id, remarks FROM raw_material_transactions
    WHERE remarks LIKE '%Correction % for Log #%'
      AND remarks NOT LIKE '%(Log #%)%'
  `);
  console.log('Without (Log #...):', res);
  process.exit(0);
}
check();
