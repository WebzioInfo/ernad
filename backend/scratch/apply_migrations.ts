import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres_js from 'postgres';

const databaseUrl = process.env.DATABASE_URL!;
const client = postgres_js(databaseUrl);
const db = drizzle(client);

async function run() {
  console.log('Applying manual migrations...');
  try {
    await client`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);`;
    await client`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);`;
    await client`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS remarks VARCHAR(500);`;
    await client`ALTER TABLE packaging_logs ADD COLUMN IF NOT EXISTS remarks VARCHAR(500);`;
    await client`ALTER TABLE dispatch_logs ADD COLUMN IF NOT EXISTS remarks VARCHAR(500);`;
    console.log('Migrations applied successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
