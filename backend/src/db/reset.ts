import 'dotenv/config';
import { Client } from 'pg';

async function reset() {
  console.log('🗑️  Starting Database Reset (Total Cleanup via PG)...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    // 1. Get all tables in public schema
    const res = await client.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
    `);

    const tables = res.rows;
    console.log(`Found ${tables.length} tables to remove.`);

    // 2. Drop all tables with CASCADE
    for (const table of tables) {
      console.log(`Dropping table: ${table.tablename}...`);
      await client.query(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
    }

    // 3. Drop all types (enums)
    const typesRes = await client.query(`
      SELECT typname 
      FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public' AND typtype = 'e'
    `);
    
    for (const type of typesRes.rows) {
        console.log(`Dropping type: ${type.typname}...`);
        await client.query(`DROP TYPE IF EXISTS "${type.typname}" CASCADE`);
    }

    console.log('✨ Database is now EMPTY.');
    
  } catch (err: any) {
    console.error('❌ Reset failed:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

reset();
