import { db } from './database/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    await db.execute(sql`ALTER TABLE "changeover_logs" ADD COLUMN IF NOT EXISTS "reason" varchar(100)`);
    await db.execute(sql`ALTER TABLE "changeover_logs" ADD COLUMN IF NOT EXISTS "notes" varchar(500)`);
    console.log('Changeover logs migrated.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
migrate();
