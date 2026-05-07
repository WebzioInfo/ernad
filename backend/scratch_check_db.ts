import { db } from './src/database/db';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const res = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables in DB:', res.map((r: any) => r.table_name).sort());
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    process.exit(0);
  }
}

check();
