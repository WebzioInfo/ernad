import { db } from './database/db';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const enums = await db.execute(sql`SELECT n.nspname as schema, t.typname as name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typtype = 'e'`);
    console.log('Enums in DB:', JSON.stringify(enums, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
