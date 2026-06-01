import { db } from './src/database/db';
import { productionLines, products, productBrands, shifts, users } from './src/database/schema';
import { BatchService } from './src/modules/production/services/batch.service';
import { ProductionEventsService } from './src/realtime/production.gateway';
import { OperatorSessionsService } from './src/modules/operator-sessions/operator-sessions.service';

async function main() {
    try {
        const line = await db.select().from(productionLines).limit(1);
        const product = await db.select().from(products).limit(1);
        const brand = await db.select().from(productBrands).limit(1);
        const shift = await db.select().from(shifts).limit(1);
        const user = await db.select().from(users).limit(1);

        console.log({
            lineId: line[0]?.id,
            productId: product[0]?.id,
            brandId: brand[0]?.id,
            shiftId: shift[0]?.id,
            userId: user[0]?.id
        });

        // Mock dependencies
        const mockEventsService = { emitLineStatus: async () => {}, emitProductionUpdated: async () => {} } as any;
        const mockSessionService = {} as any;

        const batchService = new BatchService(mockEventsService, mockSessionService);

        const res = await batchService.startBatch(
            line[0]?.id,
            brand[0]?.id,
            product[0]?.id,
            shift[0]?.id,
            user[0]?.id,
            'TEST-' + Date.now(),
            'Test remarks',
            new Date().toISOString()
        );

        console.log("SUCCESS:", res);

    } catch(e) {
        console.error("FAILED IN SCRIPT", e);
    }
    process.exit(0);
}
main();
