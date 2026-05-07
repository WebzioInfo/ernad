import { db } from './src/database/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const sqlFile = path.join(__dirname, 'drizzle', '0002_vengeful_lady_deathstrike.sql');
  const content = fs.readFileSync(sqlFile, 'utf8');
  const statements = content.split('--> statement-breakpoint');

  console.log(`Executing ${statements.length} statements...`);

  for (let statement of statements) {
    statement = statement.trim();
    if (!statement) continue;
    
    try {
      await db.execute(sql.raw(statement));
      console.log('✅ Success:', statement.substring(0, 50) + '...');
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.warn('⚠️ Skipped (Already exists):', statement.substring(0, 50) + '...');
      } else {
        console.error('❌ Failed:', statement.substring(0, 50) + '...');
        console.error(err.message);
      }
    }
  }
  process.exit(0);
}

migrate();
