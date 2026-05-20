const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Running migration...');
    
    await client.query(`
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "label_sticker_weight" numeric(10, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "damaged_label_weight" numeric(10, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "ink_changed" boolean DEFAULT false;
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "ink_usage_ml" numeric(8, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "makeup_changed" boolean DEFAULT false;
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "makeup_usage_ml" numeric(8, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "shrink_waste_weight" numeric(8, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "source_batch_number" varchar(100);

      ALTER TABLE "packaging_configurations" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
      ALTER TABLE "packaging_configurations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
    `);
    
    console.log('Migration successful.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
