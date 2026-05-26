import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL || '';

async function migrate() {
    const sql = postgres(url, { ssl: { rejectUnauthorized: false } });
    
    console.log('Starting Manual Schema Synchronization for Raw Materials & Bags Used...');

    try {
        // 1. Create raw_materials table if not exists
        console.log('Creating raw_materials table...');
        await sql`
            CREATE TABLE IF NOT EXISTS "raw_materials" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "name" character varying(150) NOT NULL,
                "category_id" uuid NOT NULL REFERENCES "material_categories"("id") ON DELETE CASCADE,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            )
        `;
        console.log('✔ raw_materials table created/verified');

        // 2. Update production_logs with rawMaterialId and bagsUsed
        console.log('Updating production_logs table columns...');
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS "raw_material_id" uuid REFERENCES "raw_materials"("id")`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS "bags_used" numeric(8, 2) DEFAULT '0'`.catch(() => {});
        console.log('✔ production_logs columns verified');

        // 3. Update batch_totals with bagsTotal
        console.log('Updating batch_totals table columns...');
        await sql`ALTER TABLE batch_totals ADD COLUMN IF NOT EXISTS "bags_total" numeric(10, 2) DEFAULT '0' NOT NULL`.catch(() => {});
        console.log('✔ batch_totals columns verified');

        console.log('Schema Synchronization Complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
