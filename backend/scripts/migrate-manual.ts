import 'dotenv/config';
import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Running raw SQL migrations...');
  
  try { await db.execute(sql`ALTER TABLE raw_materials ADD COLUMN material_type VARCHAR(50) DEFAULT 'OTHER' NOT NULL;`); } catch(e) { console.log(e.message) }
  try { await db.execute(sql`ALTER TABLE raw_materials ADD COLUMN unit VARCHAR(50) DEFAULT 'PCS' NOT NULL;`); } catch(e) { console.log(e.message) }
  try { await db.execute(sql`ALTER TABLE raw_materials ADD COLUMN current_stock INTEGER DEFAULT 0 NOT NULL;`); } catch(e) { console.log(e.message) }
  
  try { await db.execute(sql`ALTER TABLE raw_materials DROP COLUMN category_id;`); } catch(e) { console.log(e.message) }
  
  try { await db.execute(sql`ALTER TABLE inventory_stock DROP COLUMN category_id;`); } catch(e) { console.log(e.message) }
  try { await db.execute(sql`ALTER TABLE inventory_stock ADD COLUMN material_type VARCHAR(50);`); } catch(e) { console.log(e.message) }

  try { await db.execute(sql`DROP TABLE IF EXISTS material_categories CASCADE;`); } catch(e) { console.log(e.message) }

  console.log('Done!');
  process.exit(0);
}

run();
