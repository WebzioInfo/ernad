import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, productionLines, shifts, productionBatches, operatorFillingLogs, products } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function simulate() {
  console.log('🧪 Starting AI Anomaly Simulation...');
  
  // Use a more conservative connection pool for Supabase
  const client = postgres(process.env.DIRECT_URL!, { 
    max: 1, 
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    ssl: { rejectUnauthorized: false } 
  });
  const db = drizzle(client);

  try {
    // 1. Get Domain Context
    const [user] = await db.select().from(users).limit(1);
    const [line] = await db.select().from(productionLines).limit(1);
    const [shift] = await db.select().from(shifts).limit(1);
    const [product] = await db.select().from(products).limit(1);

    if (!user || !line || !shift || !product) {
        console.error('❌ Incomplete master data.');
        return;
    }

    // 2. Ensure Active Batch
    let [batch] = await db.select().from(productionBatches).where(eq(productionBatches.status, 'RUNNING')).limit(1);
    if (!batch) {
        console.log('📦 Starting new simulation batch...');
        const newBatchResults = await db.insert(productionBatches).values({
            lineId: line.id,
            brandId: product.brandId,
            productId: product.id,
            shiftId: shift.id,
            status: 'RUNNING',
            startTime: new Date()
        }).returning();
        batch = newBatchResults[0];
    }
    console.log(`✅ Using Batch ID: ${batch.id}`);

    // 3. Clear existing logs for this batch
    await db.delete(operatorFillingLogs).where(eq(operatorFillingLogs.batchId, batch.id));

    // 4. Insert 10 "Baseline" logs (Wastage 1-3)
    console.log('📉 Inserting baseline logs (Stable Production)...');
    const logs = Array.from({ length: 10 }).map((_, i) => ({
        batchId: batch.id,
        userId: user.id,
        bottleCount: 500,
        capWastage: Math.floor(Math.random() * 3) + 1,
        boxesUsed: 2,
        loggedAt: new Date(Date.now() - (10 - i) * 60000)
    }));
    await db.insert(operatorFillingLogs).values(logs);

    // 5. Insert 1 "Anomaly" log (Wastage = 45)
    console.log('🚨 Inserting ANOMALY log (Wastage = 45)...');
    await db.insert(operatorFillingLogs).values({
        batchId: batch.id,
        userId: user.id,
        bottleCount: 500,
        capWastage: 45,
        boxesUsed: 2,
        loggedAt: new Date()
    });

    console.log('\n✨ Simulation Succeeded!');
    console.log(`Batch ID: ${batch.id}`);
    console.log(`Check Detection: GET /api/analytics/filling-anomalies?batchId=${batch.id}`);
  } catch (err: any) {
    console.error('❌ Simulation Error:', err.message);
  } finally {
    await client.end();
  }
}

simulate();
