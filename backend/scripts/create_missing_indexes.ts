import 'dotenv/config';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ernad',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  console.log('Creating missing database indexes...');
  const client = await pool.connect();
  try {
    // 1. Audit logs actor and occurred index
    console.log('Creating index idx_audit_actor_occurred on audit_logs...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_actor_occurred 
      ON audit_logs(actor_id, occurred_at DESC);
    `);

    // 2. Active operator sessions index
    console.log('Creating index idx_sessions_active on operator_sessions...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_active 
      ON operator_sessions(is_active, user_id);
    `);

    // 3. Active downtime logs index
    console.log('Creating index idx_downtime_active on downtime_logs...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_downtime_active 
      ON downtime_logs(batch_id, end_time);
    `);

    // 4. Start time index on downtime logs
    console.log('Creating index idx_downtime_time on downtime_logs...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_downtime_time 
      ON downtime_logs(start_time);
    `);

    console.log('✅ Indexes created successfully!');
  } catch (err: any) {
    console.error('Failed to create indexes:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
