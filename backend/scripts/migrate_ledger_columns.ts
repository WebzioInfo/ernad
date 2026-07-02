import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Starting Ledger Columns Migration...');
  
  const tables = [
    'product_stock_transactions',
    'production_logs',
    'dispatch_logs',
    'sales_transactions'
  ];

  try {
    for (const table of tables) {
      console.log(`Adding columns to ${table}...`);
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "stock_balance_after" numeric(12, 2);`));
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "produced_balance_after" numeric(12, 2);`));
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "dispatched_balance_after" numeric(12, 2);`));
    }
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

run();
