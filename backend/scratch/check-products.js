const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  try {
    const brands = await sql`SELECT * FROM product_brands`;
    console.log('--- BRANDS ---');
    console.log(JSON.stringify(brands, null, 2));

    const products = await sql`SELECT * FROM products`;
    console.log('--- PRODUCTS ---');
    console.log(JSON.stringify(products, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

run();
