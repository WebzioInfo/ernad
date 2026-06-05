const { db } = require('./src/database/db');
const { sql } = require('drizzle-orm');

async function test() {
  try {
    const rmts = await db.execute(sql`
      SELECT rmt.remarks, rmt.quantity_change, rm.name, rm.unit 
      FROM raw_material_transactions rmt
      JOIN raw_materials rm ON rm.id = rmt.material_id
      LIMIT 1
    `);
    console.log(Array.isArray(rmts));
    console.log(rmts);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
test();
