import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function inspect() {
  try {
    const columns = await db.execute(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'warehouse_locations'"
    );
    console.log('--- Columns ---');
    console.table(columns);

    const fks = await db.execute(`
      SELECT
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='warehouse_locations';
    `);
    console.log('--- FKs ---');
    console.table(fks);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

inspect();
