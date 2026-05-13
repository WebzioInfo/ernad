import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function inspect() {
  try {
    const result = await db.execute(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'downtime_logs\''
    );
    console.log('--- downtime_logs Schema ---');
    console.log(result);
  } catch (err) {
    console.error('Error inspecting table:', err);
  } finally {
    await client.end();
  }
}

inspect();
