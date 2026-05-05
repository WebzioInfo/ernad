import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function verify() {
  console.log('--- ENDPOINT VERIFICATION START ---');
  
  try {
    // 1. Fetch Products
    const productsList = await client`SELECT * FROM products LIMIT 5`;
    console.log(`Products fetched: ${productsList.length}`);
    if (productsList.length > 0) {
      console.log('Sample Product:', productsList[0]);
    }

    // 2. Fetch Active Batch (Simulate endpoint logic)
    const activeBatches = await client`
      SELECT pb.id, pb.batch_code, pb.status, p.name as product_name
      FROM production_batches pb
      JOIN products p ON pb.product_id = p.id
      WHERE pb.status IN ('RUNNING', 'CHANGEOVER')
      LIMIT 1
    `;
    console.log(`Active batches found: ${activeBatches.length}`);
    if (activeBatches.length > 0) {
      console.log('Active Batch:', activeBatches[0]);
    }

    // 3. Check Session Columns again to be 100% sure
    const sessionCols = await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'operator_sessions'`;
    console.log('Confirmed session columns:', sessionCols.map(c => c.column_name).join(', '));

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await client.end();
  }
}

verify();
