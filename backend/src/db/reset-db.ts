import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function reset() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Resetting Database...');
    
    await client.query(`
      DROP TABLE IF EXISTS "factory_logs" CASCADE;
      DROP TABLE IF EXISTS "materials_usage" CASCADE;
      DROP TABLE IF EXISTS "batch_totals" CASCADE;
      DROP TABLE IF EXISTS "audit_logs" CASCADE;
      DROP TABLE IF EXISTS "notifications" CASCADE;
      DROP TABLE IF EXISTS "device_tokens" CASCADE;
      DROP TABLE IF EXISTS "operator_blowing_logs" CASCADE;
      DROP TABLE IF EXISTS "operator_filling_logs" CASCADE;
      DROP TABLE IF EXISTS "operator_labeling_logs" CASCADE;
      DROP TABLE IF EXISTS "operator_packing_logs" CASCADE;
      DROP TABLE IF EXISTS "changeover_logs" CASCADE;
      DROP TABLE IF EXISTS "material_flows" CASCADE;
      DROP TABLE IF EXISTS "production_batches" CASCADE;
      DROP TABLE IF EXISTS "products" CASCADE;
      DROP TABLE IF EXISTS "brands" CASCADE;
      DROP TABLE IF EXISTS "shifts" CASCADE;
      DROP TABLE IF EXISTS "production_lines" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;
      DROP TABLE IF EXISTS "operators" CASCADE;
      
      DROP TYPE IF EXISTS "station_type";
      DROP TYPE IF EXISTS "event_type";
      DROP TYPE IF EXISTS "batch_status";
      DROP TYPE IF EXISTS "user_role";
    `);
    
    console.log('Database reset complete.');
    await client.end();
  } catch (err) {
    console.error('Reset error:', err);
  }
}

reset();
