import { db } from './database/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    console.log('Applying migrations manually...');

    // 1. Production Lines updates
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "current_operator_id" uuid REFERENCES "users"("id")`);
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "current_session_id" uuid`);
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "session_started_at" timestamp`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_lines_status" ON "production_lines" ("status")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_lines_operator" ON "production_lines" ("current_operator_id")`);

    // 2. Create Log Status Enum if not exists
    try {
      await db.execute(sql`CREATE TYPE "log_status" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CORRECTED', 'OVERRIDDEN')`);
    } catch (e) {
      console.log('Enum log_status might already exist, skipping...');
    }

    // 3. Production Logs updates
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "status" "log_status" DEFAULT 'SUBMITTED' NOT NULL`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verified_by" uuid REFERENCES "users"("id")`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verified_at" timestamp`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verification_reason" varchar(500)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_production_logs_status" ON "production_logs" ("status")`);

    console.log('Migrations applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
