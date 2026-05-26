const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    console.log('Connecting to database...');
    
    const categories = await sql`SELECT * FROM material_categories`;
    console.log('--- MATERIAL CATEGORIES ---');
    console.table(categories);

    const materials = await sql`SELECT * FROM raw_materials`;
    console.log('--- RAW MATERIALS ---');
    console.table(materials);

    const joined = await sql`
      SELECT rm.id, rm.name, rm.category_id, mc.name as category_name
      FROM raw_materials rm
      INNER JOIN material_categories mc ON rm.category_id = mc.id
    `;
    console.log('--- JOINED MATERIALS ---');
    console.table(joined);

  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    await sql.end();
  }
}

run();
