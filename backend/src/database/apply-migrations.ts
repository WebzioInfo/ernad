import 'dotenv/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Client } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('🚀 Checking for new migrations in ./drizzle folder...');
    
    const migrationsDir = './drizzle';
    const files = (await fs.readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Executing ${file}...`);
      const sqlFile = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      const statements = sqlFile.split('--> statement-breakpoint');

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await client.query(statement);
          } catch (e: any) {
            // Ignore duplicate errors if we are re-running migrations
            // 42P07: relation already exists, 42710: extension/index already exists, 42701: column already exists
            // 42703: undefined_column, 42704: undefined_object
            if (['42P07', '42710', '42701', '42703', '42704'].includes(e.code)) {
               // console.log(`  (Skipping expected conflict: ${e.code})`);
            } else {
              throw e;
            }
          }
        }
      }
    }
    
    console.log('✅ All migrations applied.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
