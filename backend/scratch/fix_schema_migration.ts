import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function migrate() {
  console.log('--- CRITICAL SCHEMA MIGRATION START ---');
  
  try {
    // 1. Hardening products table
    console.log('Aligning products table...');
    await client`ALTER TABLE products ADD COLUMN IF NOT EXISTS target_bpm INTEGER NOT NULL DEFAULT 120`;

    // 2. Aligning operator_sessions table
    console.log('Aligning operator_sessions table...');
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS batch_id UUID`;
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS station_type VARCHAR(50)`;
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS ended_by UUID`;
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS end_reason VARCHAR(100)`;
    await client`ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()`;
    
    // Safety check for renames
    const cols = await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'operator_sessions'`;
    const colNames = cols.map(c => c.column_name);
    
    if (colNames.includes('login_time') && !colNames.includes('start_time')) {
      console.log('Renaming login_time to start_time...');
      await client`ALTER TABLE operator_sessions RENAME COLUMN login_time TO start_time`;
    }
    if (colNames.includes('logout_time') && !colNames.includes('end_time')) {
      console.log('Renaming logout_time to end_time...');
      await client`ALTER TABLE operator_sessions RENAME COLUMN logout_time TO end_time`;
    }

    // 3. Aligning production_logs
    console.log('Aligning production_logs table...');
    await client`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS session_id UUID`;
    
    // Add missing constraints if needed
    // Note: session_id is NULLABLE to prevent breaking old data
    
    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration FAILED:', err);
  } finally {
    await client.end();
  }
}

migrate();
