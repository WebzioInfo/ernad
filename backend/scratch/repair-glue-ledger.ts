import { db } from '../src/database/db';
import { sql, eq, and } from 'drizzle-orm';
import { productionLogs, rawMaterialTransactions, rawMaterials } from '../src/database/schema';

async function main() {
  console.log('Starting Glue Ledger Repair Script...');
  
  // 1. Fetch all LABELING logs where glueUsageKg is set and > 0
  const logs = await db.select().from(productionLogs).where(
    and(
      sql`station = 'LABELING'`,
      sql`glue_usage_kg IS NOT NULL`,
      sql`CAST(glue_usage_kg AS NUMERIC) > 0`
    )
  );

  console.log(`Found ${logs.length} Labeling logs with Glue usage.`);

  for (const log of logs) {
    const actualGlueUsage = Number(log.glueUsageKg);
    if (isNaN(actualGlueUsage) || actualGlueUsage <= 0) continue;

    // Find the corresponding Glue transaction
    // remarks pattern: "Glue used in Labeling Station (Log #ID)"
    // or just checking remarks contains "(Log #ID)" and material is Glue
    const rmts = await db.execute(sql`
      SELECT rmt.id, rmt.quantity_change, rm.name, rmt.remarks
      FROM raw_material_transactions rmt
      JOIN raw_materials rm ON rm.id = rmt.material_id
      WHERE rmt.remarks ~ ${'\\(Log #(' + log.id + ')\\)'}
      AND rm.name = 'Glue'
    `);

    if (rmts.length === 0) {
      console.log(`Log #${log.id}: No Glue transaction found. Skipping.`);
      continue;
    }

    const tx = rmts[0];
    const recordedQty = Math.abs(Number(tx.quantity_change));
    
    if (Math.abs(recordedQty - actualGlueUsage) > 0.001) {
      console.log(`Log #${log.id} (Tx ID: ${tx.id}): Incorrect Glue qty. Log says ${actualGlueUsage}, Tx says ${recordedQty}.`);
      
      // Update the transaction
      const newQtyChange = -actualGlueUsage;
      await db.execute(sql`
        UPDATE raw_material_transactions
        SET quantity_change = ${String(newQtyChange)}
        WHERE id = ${tx.id}
      `);
      console.log(`  -> Updated transaction ${tx.id} to ${newQtyChange}`);
    } else {
      console.log(`Log #${log.id}: Glue transaction correct (${recordedQty}).`);
    }
  }

  // 2. Recalculate balances for Glue
  console.log('Recalculating Glue balances...');
  const glueMats = await db.select().from(rawMaterials).where(eq(rawMaterials.name, 'Glue')).limit(1);
  if (glueMats.length === 0) {
    console.log('Glue material not found.');
    return;
  }
  const glueMat = glueMats[0];

  const allGlueTxs = await db.select().from(rawMaterialTransactions)
    .where(eq(rawMaterialTransactions.materialId, glueMat.id))
    .orderBy(sql`created_at ASC, id ASC`);

  let runningBalance = 0;
  for (const tx of allGlueTxs) {
    runningBalance += Number(tx.quantityChange || 0);
    if (Math.abs(Number(tx.balanceAfter) - runningBalance) > 0.001) {
      await db.update(rawMaterialTransactions)
        .set({ balanceAfter: String(runningBalance) })
        .where(eq(rawMaterialTransactions.id, tx.id));
    }
  }

  await db.update(rawMaterials)
    .set({ currentStock: String(runningBalance), updatedAt: new Date() })
    .where(eq(rawMaterials.id, glueMat.id));
  
  console.log(`Glue balance recalculated. Final stock: ${runningBalance}`);
  console.log('Repair complete.');
}

main().catch(console.error).finally(() => process.exit(0));
