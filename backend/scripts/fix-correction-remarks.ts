import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function fix() {
  console.log('Fixing correction remarks...');
  const res = await db.execute(sql`
    UPDATE raw_material_transactions
    SET remarks = remarks || ' (Log #' || substring(remarks from 'for Log #([0-9]+)') || ')'
    WHERE remarks LIKE '%Correction % for Log #%'
      AND remarks NOT LIKE '%(Log #%)%';
  `);
  console.log('Updated rows:', res);
  process.exit(0);
}

fix().catch(console.error);
