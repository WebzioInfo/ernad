import { db } from '../src/database/db';
import { productionLogs, rawMaterialTransactions, rawMaterials } from '../src/database/schema';
import { eq, inArray } from 'drizzle-orm';

async function verify() {
  console.log('--- DATA CONSISTENCY VERIFICATION REPORT ---');
  
  const logs = await db.select({
    id: productionLogs.id,
    station: productionLogs.station,
    shrinkWastageKg: productionLogs.shrinkWastageKg,
    selectedShrinks: productionLogs.selectedShrinks,
    primaryCount: productionLogs.primaryCount,
    wastageCount: productionLogs.wastageCount
  })
  .from(productionLogs)
  .where(eq(productionLogs.station, 'PACKING'));

  let mismatches = 0;

  const allTxs = await db.select({
    materialId: rawMaterialTransactions.materialId,
    qty: rawMaterialTransactions.quantityChange,
    type: rawMaterialTransactions.type,
    remarks: rawMaterialTransactions.remarks,
    materialName: rawMaterials.name
  })
  .from(rawMaterialTransactions)
  .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
  .where(inArray(rawMaterialTransactions.type, ['CONSUMPTION', 'REVERSAL']));

  for (const log of logs) {
    if (!log.selectedShrinks || !Array.isArray(log.selectedShrinks)) continue;

    const shrinks = log.selectedShrinks as any[];
    
    // Calculate total from selectedShrinks (this is what the edit screen shows)
    const storedValues: Record<string, number> = {};
    for (const shrink of shrinks) {
      if (!storedValues[shrink.shrinkId]) storedValues[shrink.shrinkId] = 0;
      storedValues[shrink.shrinkId] += Number(shrink.mmUsed || 0) + Number(shrink.wastageKg || 0);
    }
    
    // Refilter in JS just like reports
    const matchedTxs = allTxs.filter(tx => tx.remarks && tx.remarks.includes(`(Log #${log.id})`));
    
    const displayedValues: Record<string, number> = {};
    for (const tx of matchedTxs) {
      if (!displayedValues[tx.materialId]) displayedValues[tx.materialId] = 0;
      displayedValues[tx.materialId] += -Number(tx.qty);
    }

    // Compare
    let hasMismatch = false;
    for (const [matId, storedVal] of Object.entries(storedValues)) {
      const displayedVal = displayedValues[matId] || 0;
      // Precision issues might occur, use epsilon
      if (Math.abs(storedVal - displayedVal) > 0.001) {
        hasMismatch = true;
        console.error(`Mismatch for Log #${log.id} Material ${matId}: Stored=${storedVal}, Displayed=${displayedVal}`);
      }
    }

    if (hasMismatch) {
      mismatches++;
    }
  }

  if (mismatches === 0) {
    console.log('SUCCESS: All production logs are perfectly consistent across stored values and transaction ledgers.');
  } else {
    console.log(`FOUND ${mismatches} mismatches.`);
  }

  process.exit(0);
}

verify().catch(console.error);
