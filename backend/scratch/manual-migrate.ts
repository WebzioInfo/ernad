import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL!);

async function migrate() {
  try {
    console.log('🚀 Running manual migration...');
    
    await sql`CREATE TABLE IF NOT EXISTS "user_lines" (
      "user_id" uuid NOT NULL,
      "line_id" uuid NOT NULL
    )`;

    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "factory_id" uuid`;

    // Foreign keys and indexes - wrapping in try/catch to ignore if they already exist
    try {
      await sql`ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`;
    } catch (e) {}
    
    try {
      await sql`ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action`;
    } catch (e) {}

    try {
      await sql`CREATE INDEX "idx_user_lines" ON "user_lines" USING btree ("user_id","line_id")`;
    } catch (e) {}

    try {
      await sql`ALTER TABLE "products" ADD CONSTRAINT "products_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE cascade ON UPDATE no action`;
    } catch (e) {}

    console.log('✅ Manual migration complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
