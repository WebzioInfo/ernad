import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function run() {
  console.log('--- Fixing Remaining Tables ---');
  
  try {
    // stock_transfers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "stock_transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "from_warehouse_id" uuid NOT NULL,
        "to_warehouse_id" uuid NOT NULL,
        "stock_id" uuid NOT NULL,
        "quantity" numeric(12, 4) NOT NULL,
        "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
        "transferred_by" uuid,
        "received_by" uuid,
        "transferred_at" timestamp DEFAULT now() NOT NULL,
        "received_at" timestamp,
        "remarks" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✔ stock_transfers created');

  } catch (err) {
    console.error('Error fixing tables:', err);
  } finally {
    await client.end();
  }
}

function sql(strings: TemplateStringsArray, ...values: any[]) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
}

run();
