import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log('Running Sales Date migration...');

    // 1. Add column sales_date as DATE (nullable first)
    console.log('Step 1: Adding sales_date column...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ADD COLUMN IF NOT EXISTS "sales_date" DATE;
    `);

    // 2. Populate existing records with DATE(created_at)
    console.log('Step 2: Migrating existing sales dates from created_at...');
    const result = await sql.unsafe(`
      UPDATE "sales_transactions" 
      SET "sales_date" = CAST("created_at" AS DATE) 
      WHERE "sales_date" IS NULL;
    `);
    console.log(`Updated existing records.`);

    // 3. Make sales_date NOT NULL
    console.log('Step 3: Altering sales_date column to be NOT NULL...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ALTER COLUMN "sales_date" SET NOT NULL;
    `);

    // 4. Drop index on created_at and create index on sales_date
    console.log('Step 4: Recreating index idx_sales_transactions_date on sales_date...');
    await sql.unsafe(`
      DROP INDEX IF EXISTS "idx_sales_transactions_date";
      CREATE INDEX IF NOT EXISTS "idx_sales_transactions_date" ON "sales_transactions" ("sales_date");
    `);

    console.log('Sales Date migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
