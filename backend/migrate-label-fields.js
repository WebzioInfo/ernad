const { db } = require('./src/database/db');
const { sql } = require('drizzle-orm');

async function run() {
  try {
    console.log('Adding label station fields to production_logs...');
    await db.execute(sql`
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "label_sticker_weight" numeric(10, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "damaged_label_weight" numeric(10, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "ink_changed" boolean DEFAULT false;
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "ink_usage_ml" numeric(8, 2);
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "makeup_changed" boolean DEFAULT false;
      ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "makeup_usage_ml" numeric(8, 2);
    `);
    console.log('Migration successful.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
