import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const sql = postgres(process.env.DIRECT_URL!, { ssl: 'require' });

async function main() {
  try {
    const filePath = path.join(process.cwd(), 'drizzle', '0001_large_arclight.sql');
    const content = fs.readFileSync(filePath, 'utf8');
    
    const statements = content.split('--> statement-breakpoint');

    console.log(`Executing ${statements.length} migration statements from 0001...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      await sql.unsafe(statement);
    }

    console.log('Migration 0001 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

main();
