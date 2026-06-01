const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const materials = await sql`SELECT * FROM raw_materials`;
    console.log('--- RAW MATERIALS ---');
    console.table(materials);
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    await sql.end();
  }
}

run();
