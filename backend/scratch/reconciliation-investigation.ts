import { db } from '../src/database/db';
import { productionLogs, rawMaterials, rawMaterialTransactions } from '../src/database/schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';

async function main() {
  console.log('--- PHASE 2 INVESTIGATION ---');
  
  // Let's get a few production logs with wastage to see how they look
  const logs = await db.select({
    id: productionLogs.id,
    station: productionLogs.station,
    rawMaterialId: productionLogs.rawMaterialId,
    bagsUsed: productionLogs.bagsUsed,
    wastageCount: productionLogs.wastageCount,
    capBoxUsage: productionLogs.capBoxUsage,
    capWastage: productionLogs.capWastage,
    shrinkWeightUsed: productionLogs.shrinkWeightUsed,
    shrinkWastageKg: productionLogs.shrinkWastageKg,
    bopRollUsage: productionLogs.bopRollUsage,
    damagedLabelWeight: productionLogs.damagedLabelWeight,
  }).from(productionLogs)
    .where(
      sql`(CAST(${productionLogs.wastageCount} AS NUMERIC) > 0 OR CAST(${productionLogs.capWastage} AS NUMERIC) > 0 OR CAST(${productionLogs.shrinkWastageKg} AS NUMERIC) > 0)`
    ).limit(20);
    
  console.log('Sample Logs with Wastage:');
  console.log(logs);

  process.exit(0);
}
main();
