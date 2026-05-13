import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

async function run() {
  console.log('--- Fixing Missing Tables ---');
  
  try {
    // 1. downtime_logs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "downtime_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "batch_id" uuid NOT NULL,
        "line_id" uuid NOT NULL,
        "factory_id" uuid NOT NULL,
        "station" varchar(50) NOT NULL,
        "reason" varchar(100) NOT NULL,
        "start_time" timestamp DEFAULT now() NOT NULL,
        "end_time" timestamp,
        "duration_minutes" integer,
        "remarks" varchar(500),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        "deleted_by" uuid,
        "deleted_reason" varchar(500)
      );
    `);
    console.log('✔ downtime_logs created');

    // 2. bill_of_materials
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "bill_of_materials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" uuid NOT NULL,
        "stock_id" uuid NOT NULL,
        "quantity_per_unit" numeric(12, 6) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✔ bill_of_materials created');

    // 3. inventory_ledger
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "inventory_ledger" (
        "id" bigserial PRIMARY KEY NOT NULL,
        "stock_id" uuid NOT NULL,
        "batch_id" uuid,
        "user_id" uuid,
        "type" varchar(50) NOT NULL,
        "quantity_change" numeric(12, 4) NOT NULL,
        "balance_after" numeric(12, 4) NOT NULL,
        "remarks" varchar(255),
        "occurred_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        "deleted_by" uuid,
        "deleted_reason" varchar(500)
      );
    `);
    console.log('✔ inventory_ledger created');

    // 4. Constraints & Indexes (Basic)
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'downtime_logs_batch_id_production_batches_id_fk') THEN
          ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_of_materials_product_id_products_id_fk') THEN
          ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_downtime_batch" ON "downtime_logs" ("batch_id");
      CREATE INDEX IF NOT EXISTS "idx_downtime_line" ON "downtime_logs" ("line_id");
      CREATE INDEX IF NOT EXISTS "idx_downtime_time" ON "downtime_logs" ("start_time");
      CREATE INDEX IF NOT EXISTS "idx_ledger_batch" ON "inventory_ledger" ("batch_id");
    `);
    console.log('✔ Constraints and Indexes applied');

  } catch (err) {
    console.error('Error fixing tables:', err);
  } finally {
    await client.end();
  }
}

// Helper to handle raw sql template literals
function sql(strings: TemplateStringsArray, ...values: any[]) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
}

run();
