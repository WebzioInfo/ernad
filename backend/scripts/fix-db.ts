import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Adding deleted_at and other columns to customers...');
    await client.query(`
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "created_by" uuid;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_id" uuid;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "branch_id" uuid;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenant_id" uuid;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_name" varchar(255);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "customer_type" varchar(50) DEFAULT 'BUSINESS' NOT NULL;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gst_number" varchar(15);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "pan_number" varchar(10);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "alternative_phone" varchar(20);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_address" text;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "shipping_address" text;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state" varchar(100);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "district" varchar(100);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "country" varchar(100);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "pin_code" varchar(20);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "opening_balance_type" varchar(10) DEFAULT 'DEBIT' NOT NULL;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100);
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" text;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(12, 2) DEFAULT '0';
    `);
    console.log('Columns added successfully.');
    
    // Also inventory_stock missing material_type?
    console.log('Adding missing columns to inventory_stock...');
    await client.query(`
      ALTER TABLE "inventory_stock" ADD COLUMN IF NOT EXISTS "material_type" varchar(50);
    `);
    console.log('Done.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

main();
