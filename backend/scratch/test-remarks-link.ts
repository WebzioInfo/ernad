import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function run() {
  const idsString = [20, 21, 23, 24, 25, 27, 38, 39, 40].join('|');
  const pattern = '\\(Log #(' + idsString + ')\\)';
  console.log('Pattern:', pattern);
  const rmts = await db.execute(sql`
    SELECT rmt.remarks, rmt.quantity_change, rm.name, rm.unit 
    FROM raw_material_transactions rmt
    JOIN raw_materials rm ON rm.id = rmt.material_id
    WHERE rmt.remarks ~ ${pattern}
  `);
  console.log('Result:', rmts);
}

run().then(() => process.exit(0)).catch(console.error);
