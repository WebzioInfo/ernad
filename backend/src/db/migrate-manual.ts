import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const sql = postgres(process.env.DIRECT_URL!, { ssl: 'require' });

async function main() {
  try {
    const filePath = path.join(process.cwd(), 'drizzle', '0000_reset.sql');
    const content = fs.readFileSync(filePath, 'utf8');
    // Nuclear Cleanup
    console.log('Performing nuclear cleanup...');
    await sql.unsafe(`
      DROP TABLE IF EXISTS 
        attendance_logs, users, batch_snapshots, changeover_logs, material_flows, 
        production_batches, audit_logs, batch_totals, device_tokens, factory_logs, 
        materials_usage, notifications, product_brands, production_lines, 
        products, shifts, operator_sessions CASCADE;
      DROP TYPE IF EXISTS user_role, batch_status, event_type, station_type CASCADE;
    `);
    
    const statements = content.split('--> statement-breakpoint');

    console.log(`Executing ${statements.length} migration statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      await sql.unsafe(statement);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

main();
