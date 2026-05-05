import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function verify() {
  console.log('--- FINAL STABILITY VERIFICATION START ---');
  
  try {
    // 1. Simulate getActiveBatch with potential NULLs
    console.log('Testing active batch retrieval with LEFT JOINs...');
    const result = await client`
      SELECT pb.id, pb.batch_code, pb.status, p.name as product_name, b.name as brand_name
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.id
      LEFT JOIN product_brands b ON pb.brand_id = b.id
      WHERE pb.status IN ('RUNNING', 'CHANGEOVER')
      LIMIT 1
    `;
    
    if (result.length > 0) {
      console.log('Active Batch Found:', {
        id: result[0].id,
        code: result[0].batch_code,
        product: result[0].product_name || 'NULL (Handled)',
        brand: result[0].brand_name || 'NULL (Handled)'
      });
      console.log('✅ Query stability confirmed.');
    } else {
      console.log('No active batches found, but query succeeded.');
    }

    // 2. Check for potential 500 triggers in Analytics
    console.log('Testing analytics aggregations with LEFT JOINs...');
    const brandPerf = await client`
      SELECT COALESCE(b.name, 'Unknown Brand') as brand, SUM(pl.primary_count)
      FROM production_logs pl
      LEFT JOIN product_brands b ON pl.brand_id = b.id
      GROUP BY b.name
      LIMIT 5
    `;
    console.log('✅ Analytics stability confirmed.');

  } catch (err) {
    console.error('Verification FAILED:', err);
  } finally {
    await client.end();
  }
}

verify();
