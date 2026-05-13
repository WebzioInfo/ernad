import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function listTables() {
  try {
    const result = await db.execute(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log('--- Public Tables ---');
    console.log(result.map((r: any) => r.table_name));
  } catch (err) {
    console.error('Error listing tables:', err);
  } finally {
    await client.end();
  }
}

listTables();
