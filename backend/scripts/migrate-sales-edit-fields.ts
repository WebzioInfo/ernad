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
    console.log('Running Sales Edit Fields migration...');

    // 0. Create customers table if it doesn't exist
    console.log('Step 0: Creating customers table...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(150) NOT NULL,
        "code" VARCHAR(20) UNIQUE,
        "email" VARCHAR(255),
        "phone" VARCHAR(20),
        "address" TEXT,
        "credit_limit" DECIMAL(12,2) DEFAULT '0.00',
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // 0.5. Seed dummy customers
    console.log('Step 0.5: Seeding sample customers...');
    await sql.unsafe(`
      INSERT INTO "customers" ("name", "code", "email", "phone", "address") VALUES
      ('Super Star Distributors', 'SSD001', 'ssd@example.com', '+1234567890', 'Distributor Main St'),
      ('Metro Beverages', 'MB002', 'metro@example.com', '+1234567891', 'Metro City Plaza'),
      ('Apex Retailers', 'AR003', 'apex@example.com', '+1234567892', 'Apex Tower Road')
      ON CONFLICT (code) DO NOTHING;
    `);

    // 1. Add customer_id column (nullable)
    console.log('Step 1: Adding customer_id column...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ADD COLUMN IF NOT EXISTS "customer_id" UUID REFERENCES "customers" ("id") ON DELETE RESTRICT;
    `);

    // 2. Add unit_price column
    console.log('Step 2: Adding unit_price column...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(12,2) DEFAULT '0.00';
    `);

    // 3. Add remarks column
    console.log('Step 3: Adding remarks column...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ADD COLUMN IF NOT EXISTS "remarks" TEXT;
    `);

    // 4. Add updated_by column (nullable)
    console.log('Step 4: Adding updated_by column...');
    await sql.unsafe(`
      ALTER TABLE "sales_transactions" 
      ADD COLUMN IF NOT EXISTS "updated_by" UUID REFERENCES "users" ("id");
    `);

    console.log('Sales Edit Fields migration completed successfully!');
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
