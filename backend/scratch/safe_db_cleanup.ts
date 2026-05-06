import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function cleanup() {
  console.log('--- SAFE DATABASE CLEANUP START ---');
  
  try {
    // 1. Detect and Fix production_batches.product_id
    console.log('Checking for invalid product_id in production_batches...');
    const invalidProducts = await client`
      UPDATE production_batches
      SET product_id = NULL
      WHERE product_id IS NOT NULL 
      AND product_id NOT IN (SELECT id FROM products)
      RETURNING id
    `;
    console.log(`Fixed ${invalidProducts.length} batches with invalid product_id.`);

    // 2. Detect and Fix production_batches.brand_id
    console.log('Checking for invalid brand_id in production_batches...');
    const invalidBrands = await client`
      UPDATE production_batches
      SET brand_id = NULL
      WHERE brand_id IS NOT NULL 
      AND brand_id NOT IN (SELECT id FROM product_brands)
      RETURNING id
    `;
    console.log(`Fixed ${invalidBrands.length} batches with invalid brand_id.`);

    // 3. Detect and Fix production_logs.product_id
    console.log('Checking for invalid product_id in production_logs...');
    const invalidLogProducts = await client`
      UPDATE production_logs
      SET product_id = (SELECT product_id FROM production_batches WHERE id = production_logs.batch_id)
      WHERE product_id IS NOT NULL
      AND product_id NOT IN (SELECT id FROM products)
      RETURNING id
    `;
    console.log(`Fixed ${invalidLogProducts.length} logs with invalid product_id.`);

    // 4. Detect and Fix production_logs.brand_id
    console.log('Checking for invalid brand_id in production_logs...');
    const invalidLogBrands = await client`
      UPDATE production_logs
      SET brand_id = (SELECT brand_id FROM production_batches WHERE id = production_logs.batch_id)
      WHERE brand_id IS NOT NULL
      AND brand_id NOT IN (SELECT id FROM product_brands)
      RETURNING id
    `;
    console.log(`Fixed ${invalidLogBrands.length} logs with invalid brand_id.`);

    // 5. Cleanup dangling operator sessions (Optional safety)
    console.log('Synchronizing inactive operator sessions...');
    const syncSessions = await client`
      UPDATE operator_sessions
      SET is_active = false, end_time = NOW(), end_reason = 'system_cleanup'
      WHERE is_active = true
      AND batch_id IS NOT NULL
      AND batch_id IN (SELECT id FROM production_batches WHERE status IN ('COMPLETED', 'CLOSED', 'QC_PENDING'))
      RETURNING id
    `;
    console.log(`Deactivated ${syncSessions.length} orphaned operator sessions.`);

    console.log('--- CLEANUP COMPLETED ---');
  } catch (err) {
    console.error('Cleanup FAILED:', err);
  } finally {
    await client.end();
  }
}

cleanup();
