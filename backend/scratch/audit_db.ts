import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function audit() {
  console.log('--- DATABASE AUDIT START ---');
  
  try {
    // Check tables
    const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    // Check operator_sessions
    const sessionCols = await client`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'operator_sessions'`;
    console.log('operator_sessions columns:', sessionCols.map(c => c.column_name).join(', '));

    // Check production_logs
    const logCols = await client`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'production_logs'`;
    console.log('production_logs columns:', logCols.map(c => c.column_name).join(', '));

    // Check products
    const productCols = await client`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'products'`;
    console.log('products columns:', productCols.map(c => c.column_name).join(', '));

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.end();
  }
}

audit();
