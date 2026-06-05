import { db } from '../src/database/db';
import * as schema from '../src/database/schema';
import { eq, isNotNull, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixCaps() {
  const fillingLogs = await db.select().from(schema.productionLogs)
    .where(and(eq(schema.productionLogs.station, 'FILLING'), isNotNull(schema.productionLogs.rawMaterialId)));
  
  for (const log of fillingLogs) {
    if (log.capBoxUsage && Number(log.capBoxUsage) > 0) {
      // Check if consumption already exists for this log
      const existing = await db.select().from(schema.rawMaterialTransactions)
        .where(and(
          eq(schema.rawMaterialTransactions.materialId, log.rawMaterialId!),
          eq(schema.rawMaterialTransactions.type, 'CONSUMPTION'),
          eq(schema.rawMaterialTransactions.remarks, `Boxes used in Capping Station (Log #${log.id})`)
        ));
      
      if (existing.length === 0) {
        console.log(`Fixing missing cap transaction for Log #${log.id} (${log.capBoxUsage} boxes)`);
        
        // Decrement from raw materials
        const [mat] = await db.select().from(schema.rawMaterials).where(eq(schema.rawMaterials.id, log.rawMaterialId!));
        if (mat) {
          const newQty = Number(mat.currentStock) - Number(log.capBoxUsage);
          await db.update(schema.rawMaterials).set({ currentStock: String(newQty) }).where(eq(schema.rawMaterials.id, log.rawMaterialId!));
          
          await db.insert(schema.rawMaterialTransactions).values({
            materialId: log.rawMaterialId!,
            type: 'CONSUMPTION',
            quantityChange: String(-Number(log.capBoxUsage)),
            balanceAfter: String(newQty),
            remarks: `Boxes used in Capping Station (Log #${log.id})`,
            performedBy: log.userId,
            createdAt: log.loggedAt
          });
        }
      }
    }
  }
  console.log('Done fixing caps');
}

fixCaps().catch(console.error).then(() => process.exit(0));
