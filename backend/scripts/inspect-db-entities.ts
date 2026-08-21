import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function main() {
  const custs = await db.execute(sql`SELECT id, name, code, phone, opening_balance, status FROM customers LIMIT 5`);
  console.log('CUSTOMERS:', JSON.stringify(custs, null, 2));

  const prods = await db.execute(sql`SELECT id, name, category, units_per_case FROM products LIMIT 5`);
  console.log('PRODUCTS:', JSON.stringify(prods, null, 2));

  const rawMats = await db.execute(sql`SELECT id, name, material_type, unit, current_stock FROM raw_materials LIMIT 5`);
  console.log('RAW MATERIALS:', JSON.stringify(rawMats, null, 2));

  const vendors = await db.execute(sql`SELECT id, name, code, phone FROM vendors LIMIT 5`);
  console.log('VENDORS:', JSON.stringify(vendors, null, 2));

  const salesDates = await db.execute(sql`SELECT sales_date, type, sum(quantity)::int as qty, count(*)::int as cnt FROM sales_transactions GROUP BY sales_date, type ORDER BY sales_date DESC LIMIT 10`);
  console.log('SALES DATES:', JSON.stringify(salesDates, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
