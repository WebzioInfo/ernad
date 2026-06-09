import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'INVESTIGATING';`);
    console.log("Added INVESTIGATING");
    await db.execute(sql`ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'CANCELLED';`);
    console.log("Added CANCELLED");
  } catch (err) {
    console.error("Error altering type:", err);
  }
  process.exit(0);
}
main();
