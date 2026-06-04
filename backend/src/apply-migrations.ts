import { db } from './database/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    console.log('Applying migrations manually...');

    // 1. Production Lines updates
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "current_operator_id" uuid REFERENCES "users"("id")`);
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "current_session_id" uuid`);
    await db.execute(sql`ALTER TABLE "production_lines" ADD COLUMN IF NOT EXISTS "session_started_at" timestamp`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_lines_status" ON "production_lines" ("status")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_lines_operator" ON "production_lines" ("current_operator_id")`);

    // 2. Create Log Status Enum if not exists
    try {
      await db.execute(sql`CREATE TYPE "log_status" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CORRECTED', 'OVERRIDDEN')`);
    } catch (e) {
      console.log('Enum log_status might already exist, skipping...');
    }

    // 3. Production Logs updates
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "status" "log_status" DEFAULT 'SUBMITTED' NOT NULL`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verified_by" uuid REFERENCES "users"("id")`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verified_at" timestamp`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "verification_reason" varchar(500)`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "cap_usage" integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "cap_box_usage" integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "cap_wastage" integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "preform_usage" integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "bop_roll_usage" decimal(8, 2) DEFAULT '0'`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "shrink_weight_used" decimal(8, 2) DEFAULT '0'`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "label_usage" integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "shrink_waste_weight" decimal(8, 2)`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "shrink_wastage_kg" decimal(8, 2) DEFAULT '0' NOT NULL`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "selected_shrinks" jsonb DEFAULT '[]'::jsonb NOT NULL`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "ink_usage_ml" decimal(8, 2)`);
    await db.execute(sql`ALTER TABLE "production_logs" ADD COLUMN IF NOT EXISTS "makeup_usage_ml" decimal(8, 2)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_production_logs_status" ON "production_logs" ("status")`);

    // 4. Drop unique batch code index and create non-unique index
    try {
      await db.execute(sql`DROP INDEX IF EXISTS "idx_batches_code_factory"`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_batches_code" ON "production_batches" ("batch_code")`);
      console.log('Successfully updated idx_batches_code index.');
    } catch (e: any) {
      console.error('Failed to update idx_batches_code:', e.message);
    }

    // 5. Update operator_sessions unique index
    try {
      await db.execute(sql`DROP INDEX IF EXISTS "idx_operator_sessions_unique_active"`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_operator_sessions_unique_active" ON "operator_sessions" ("user_id", "line_id", "station_type") WHERE "is_active" = true`);
      console.log('Successfully updated idx_operator_sessions_unique_active to be per user, line, and station.');
    } catch (e: any) {
      console.error('Failed to update idx_operator_sessions_unique_active:', e.message);
    }

    // 6. Create machine_states table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "machine_states" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "line_id" uuid NOT NULL REFERENCES "production_lines"("id") ON DELETE CASCADE,
          "station" varchar(50) NOT NULL,
          "state" varchar(50) NOT NULL DEFAULT 'STOPPED',
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_machine_states_line_station" ON "machine_states" ("line_id", "station")`);
      console.log('Successfully created machine_states table and index.');
    } catch (e: any) {
      console.error('Failed to create machine_states table:', e.message);
    }

    // 7. Create shift_handovers table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "shift_handovers" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "line_id" uuid NOT NULL REFERENCES "production_lines"("id") ON DELETE CASCADE,
          "station" varchar(50) NOT NULL,
          "batch_id" uuid NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
          "outgoing_operator_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "incoming_operator_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "handover_time" timestamp NOT NULL DEFAULT now(),
          "outgoing_session_id" uuid REFERENCES "operator_sessions"("id") ON DELETE SET NULL,
          "incoming_session_id" uuid REFERENCES "operator_sessions"("id") ON DELETE SET NULL,
          "notes" text,
          "pending_issues" text,
          "machine_state_snapshot" varchar(50),
          "production_count_snapshot" integer DEFAULT 0,
          "waste_count_snapshot" integer DEFAULT 0,
          "material_state_confirmed" boolean DEFAULT false,
          "machine_status_acknowledged" boolean DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now()
        );
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_shift_handovers_line_station" ON "shift_handovers" ("line_id", "station")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_shift_handovers_batch" ON "shift_handovers" ("batch_id")`);
      console.log('Successfully created shift_handovers table and indexes.');
    } catch (e: any) {
      console.error('Failed to create shift_handovers table:', e.message);
    }

    // 8. Inventory Module updates
    try {
      console.log('Applying Inventory updates...');
      // Add current_stock column to raw_materials table if not exists
      await db.execute(sql`ALTER TABLE "raw_materials" ADD COLUMN IF NOT EXISTS "current_stock" integer NOT NULL DEFAULT 0`);
      
      // Create raw_material_transactions table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "raw_material_transactions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "material_id" uuid NOT NULL REFERENCES "raw_materials"("id") ON DELETE CASCADE,
          "type" varchar(50) NOT NULL,
          "quantity_change" integer NOT NULL,
          "balance_after" integer NOT NULL,
          "remarks" text,
          "performed_by" uuid REFERENCES "users"("id"),
          "created_at" timestamp NOT NULL DEFAULT now()
        );
      `);

      // Create product_stock_transactions table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "product_stock_transactions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
          "type" varchar(50) NOT NULL,
          "quantity_change" integer NOT NULL,
          "balance_after" integer NOT NULL,
          "remarks" text,
          "performed_by" uuid REFERENCES "users"("id"),
          "created_at" timestamp NOT NULL DEFAULT now()
        );
      `);
      
      // Create production_stock table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "production_stock" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "product_id" uuid NOT NULL UNIQUE REFERENCES "products"("id") ON DELETE CASCADE,
          "current_stock" integer NOT NULL DEFAULT 0,
          "total_produced" integer NOT NULL DEFAULT 0,
          "total_dispatched" integer NOT NULL DEFAULT 0,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
      `);

      // Ensure "Raw Materials" category exists
      await db.execute(sql`
        INSERT INTO "material_categories" ("id", "name", "description")
        VALUES (gen_random_uuid(), 'Raw Materials', 'Raw material components')
        ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED.description;
      `);

      // Ensure Preforms raw material exists
      await db.execute(sql`
        INSERT INTO "raw_materials" ("id", "name", "category_id")
        SELECT gen_random_uuid(), 'Preforms', id
        FROM "material_categories"
        WHERE "name" = 'Raw Materials'
          AND NOT EXISTS (SELECT 1 FROM "raw_materials" WHERE "name" = 'Preforms');
      `);

      // Ensure Caps raw material exists
      await db.execute(sql`
        INSERT INTO "raw_materials" ("id", "name", "category_id")
        SELECT gen_random_uuid(), 'Caps', id
        FROM "material_categories"
        WHERE "name" = 'Raw Materials'
          AND NOT EXISTS (SELECT 1 FROM "raw_materials" WHERE "name" = 'Caps');
      `);

      // Initialize production stock rows for existing products
      await db.execute(sql`
        INSERT INTO "production_stock" ("id", "product_id", "current_stock", "total_produced", "total_dispatched")
        SELECT gen_random_uuid(), id, 0, 0, 0
        FROM "products"
        ON CONFLICT ("product_id") DO NOTHING;
      `);

      console.log('Successfully applied Inventory Module tables and seeds.');
    } catch (e: any) {
      console.error('Failed to apply Inventory Module tables and seeds:', e.message);
    }

    console.log('Migrations applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
