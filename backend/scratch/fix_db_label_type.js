const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const res = await sql`
      UPDATE raw_materials 
      SET material_type = 'LABEL' 
      WHERE name = 'Label - Kenby 500ML'
    `;
    console.log('Update result:', res);
  } catch (error) {
    console.error('Error running query:', error);
  } finally {
    await sql.end();
  }
}

run();
