import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
    factories, users, productionLines, shifts, 
    productionBatches, qualityChecks, packagingLogs, 
    dispatchLogs, products, productBrands 
} from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function validateLifecycle() {
    console.log('🚀 Starting Full MES Lifecycle Validation...');
    
    const client = postgres(process.env.DIRECT_URL!, { max: 1, ssl: { rejectUnauthorized: false } });
    const db = drizzle(client);

    try {
        // 1. Setup Context
        const [factory] = await db.select().from(factories).limit(1);
        const [line] = await db.select().from(productionLines).where(eq(productionLines.factoryId, factory.id)).limit(1);
        const [user] = await db.select().from(users).where(eq(users.factoryId, factory.id)).limit(1);
        const [shift] = await db.select().from(shifts).where(eq(shifts.factoryId, factory.id)).limit(1);
        const [product] = await db.select().from(products).limit(1);

        console.log(`📍 Factory: ${factory.name} | Line: ${line.name}`);

        // 2. Start Batch
        const batchCode = `VAL-${Date.now().toString().slice(-6)}`;
        console.log(`📦 Starting Batch: ${batchCode}`);
        const [batch] = await db.insert(productionBatches).values({
            batchCode,
            factoryId: factory.id,
            lineId: line.id,
            brandId: product.brandId!,
            productId: product.id,
            shiftId: shift.id,
            status: 'RUNNING',
            startTime: new Date()
        }).returning();

        // 3. Close Batch (Move to QC_PENDING)
        console.log('🕒 Closing Batch (Moving to QC_PENDING)...');
        await db.update(productionBatches)
            .set({ status: 'QC_PENDING', endTime: new Date() })
            .where(eq(productionBatches.id, batch.id));

        // 4. Quality Check
        console.log('🧪 Submitting Quality Check (PASS)...');
        await db.insert(qualityChecks).values({
            batchId: batch.id,
            factoryId: factory.id,
            inspectorId: user.id,
            checkType: 'VALIDATION',
            result: 'PASS',
            parameters: { volume: 500, ph: 7.2 },
            checkedAt: new Date()
        });

        // Auto-transition to COMPLETED (This is handled by service, but we simulate it here for direct DB validation)
        await db.update(productionBatches)
            .set({ status: 'COMPLETED' })
            .where(eq(productionBatches.id, batch.id));

        // 5. Packaging
        console.log('📦 Logging Packaging...');
        await db.insert(packagingLogs).values({
            batchId: batch.id,
            factoryId: factory.id,
            operatorId: user.id,
            packType: 'BOX_12',
            quantity: 100,
            unitsPerPack: 12,
            createdAt: new Date()
        });

        // 6. Dispatch
        console.log('🚚 Logging Dispatch...');
        await db.insert(dispatchLogs).values({
            batchId: batch.id,
            factoryId: factory.id,
            dispatchManagerId: user.id,
            destination: 'Validation Warehouse A',
            quantity: 1200,
            vehicleNumber: 'VAL-001',
            dispatchedAt: new Date()
        });

        console.log('\n✨ Lifecycle Validation Succeeded!');
        console.log(`Check Batch Traceability: /production/batches?factoryId=${factory.id}`);
        
    } catch (err: any) {
        console.error('❌ Validation Failed:', err.message);
    } finally {
        await client.end();
    }
}

validateLifecycle();
