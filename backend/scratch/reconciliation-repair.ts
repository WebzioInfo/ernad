import { db } from '../src/database/db';
import { productionLogs, rawMaterials, rawMaterialTransactions } from '../src/database/schema';
import { eq, asc, like } from 'drizzle-orm';

async function main() {
  console.log("Starting Repair Migration...");
  
  await db.transaction(async (tx) => {
    const logs = await tx.select().from(productionLogs);
    let updatedTxCount = 0;
    const affectedMaterialIds = new Set<string>();

    for (const log of logs) {
      if (log.station === 'LABELING' || log.station === 'PACKING') {
        let usage = 0;
        let wastage = 0;
        
        if (log.station === 'LABELING') {
          usage = Number(log.bopRollUsage || 0);
          wastage = Number(log.damagedLabelWeight || log.wastageCount || 0);
        } else if (log.station === 'PACKING') {
          if (log.selectedShrinks && (log.selectedShrinks as any[]).length > 0) {
            // we process it in the transaction loop directly
          } else {
            usage = Number(log.shrinkWeightUsed || 0);
            wastage = Number(log.shrinkWastageKg || 0);
          }
        }

        const logIdStr = `(Log #${log.id})`;
        const txs = await tx.select()
            .from(rawMaterialTransactions)
            .where(like(rawMaterialTransactions.remarks, `%${logIdStr}%`));

        for (const t of txs) {
            if (log.station === 'PACKING' && log.selectedShrinks && (log.selectedShrinks as any[]).length > 0) {
                const s = (log.selectedShrinks as any[]).find(x => x.shrinkId === t.materialId);
                if (s) {
                    const expectedDeduction = Number(s.mmUsed || 0) + Number(s.wastageKg || 0);
                    const qtyChange = t.type === 'CONSUMPTION' ? -expectedDeduction : expectedDeduction;
                    if (Number(t.quantityChange) !== qtyChange) {
                        await tx.update(rawMaterialTransactions).set({ quantityChange: String(qtyChange) }).where(eq(rawMaterialTransactions.id, t.id));
                        updatedTxCount++;
                        if (t.materialId) affectedMaterialIds.add(t.materialId);
                    }
                }
            } else {
                if (wastage > 0) {
                    const expectedDeduction = usage + wastage;
                    const qtyChange = t.type === 'CONSUMPTION' ? -expectedDeduction : expectedDeduction;
                    if (Number(t.quantityChange) !== qtyChange) {
                        await tx.update(rawMaterialTransactions).set({ quantityChange: String(qtyChange) }).where(eq(rawMaterialTransactions.id, t.id));
                        updatedTxCount++;
                        if (t.materialId) affectedMaterialIds.add(t.materialId);
                    }
                }
            }
        }
      }
    }

    console.log(`Updated ${updatedTxCount} transactions.`);
    
    console.log("Recalculating ledger balances for affected materials...");
    for (const matId of affectedMaterialIds) {
      const allTxs = await tx.select()
        .from(rawMaterialTransactions)
        .where(eq(rawMaterialTransactions.materialId, matId))
        .orderBy(asc(rawMaterialTransactions.createdAt));

      let balance = 0;
      for (const t of allTxs) {
        balance += Number(t.quantityChange);
        await tx.update(rawMaterialTransactions)
          .set({ balanceAfter: String(balance) })
          .where(eq(rawMaterialTransactions.id, t.id));
      }

      await tx.update(rawMaterials)
        .set({ currentStock: String(balance) })
        .where(eq(rawMaterials.id, matId));
        
      console.log(`Rebuilt balance for material ${matId} -> Final Balance: ${balance.toFixed(2)}`);
    }
  });

  console.log("Repair Migration Complete.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
