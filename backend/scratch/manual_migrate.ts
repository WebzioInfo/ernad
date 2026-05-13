import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL || '';

async function migrate() {
    const sql = postgres(url, { ssl: { rejectUnauthorized: false } });
    
    console.log('Starting Manual Schema Synchronization...');

    try {
        // 1. Update Enums
        console.log('Updating Enums...');
        await sql`ALTER TYPE station_type ADD VALUE IF NOT EXISTS 'QC'`.catch(() => {});
        await sql`DO $$ BEGIN CREATE TYPE qc_status AS ENUM ('PASSED', 'FAILED', 'PENDING'); EXCEPTION WHEN duplicate_object THEN null; END $$;`.catch(() => {});

        // 2. Update production_logs
        console.log('Updating production_logs...');
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id)`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS updated_at timestamp`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS deleted_at timestamp`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id)`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS deleted_reason character varying(500)`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS ph_value numeric(4,2)`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS tds_value numeric(6,2)`.catch(() => {});
        await sql`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS test_result qc_status`.catch(() => {});

        // 3. Update production_batches
        console.log('Updating production_batches...');
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS target_quantity integer`.catch(() => {});
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id)`.catch(() => {});
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`.catch(() => {});
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS deleted_at timestamp`.catch(() => {});
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id)`.catch(() => {});
        await sql`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS deleted_reason character varying(500)`.catch(() => {});

        console.log('Schema Synchronization Complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
