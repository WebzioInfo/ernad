import { db } from '../src/database/db';
import { productionLogs, rawMaterials, rawMaterialTransactions } from '../src/database/schema';

async function main() {
  const logs = await db.select().from(productionLogs);
  const materials = await db.select().from(rawMaterials);

  const matMap = new Map();
  materials.forEach(m => matMap.set(m.id, m));

  const report = [];
  const materialImpact: any = {};

  for (const log of logs) {
    if (log.station === 'LABELING' || log.station === 'PACKING') {
      let usage = 0;
      let wastage = 0;
      let materialId = log.rawMaterialId;
      
      if (log.station === 'LABELING') {
        usage = Number(log.bopRollUsage || 0);
        wastage = Number(log.damagedLabelWeight || log.wastageCount || 0);
      } else if (log.station === 'PACKING') {
        if (log.selectedShrinks && (log.selectedShrinks as any[]).length > 0) {
          // Reversals leaked wastage for JSON shrinks, so we need to repair those too.
          // But for now, just look at the raw un-reconciled JSON.
          for (const s of (log.selectedShrinks as any[])) {
             const u = Number(s.mmUsed || 0);
             const w = Number(s.wastageKg || 0);
             if (w > 0) {
                const variance = w; // The leak happens on edit/delete. For now we assume leak if exist
                const m = matMap.get(s.shrinkId);
                report.push({
                  LogID: log.id,
                  Station: log.station,
                  Material: m ? m.name : 'Unknown',
                  Usage: u,
                  Wastage: w,
                  ExpectedDeduction: u + w,
                  AssumedActualDeduction: u,
                  Variance: variance
                });
                if (!materialImpact[s.shrinkId]) {
                  materialImpact[s.shrinkId] = { name: m ? m.name : 'Unknown', variance: 0, count: 0 };
                }
                materialImpact[s.shrinkId].variance += variance;
                materialImpact[s.shrinkId].count += 1;
             }
          }
          continue;
        } else {
          usage = Number(log.shrinkWeightUsed || 0);
          wastage = Number(log.shrinkWastageKg || 0);
        }
      }

      if (wastage > 0) {
        const expectedDeduction = usage + wastage;
        const variance = wastage; 

        if (variance > 0) {
          const m = matMap.get(materialId);
          report.push({
            LogID: log.id,
            Station: log.station,
            Material: m ? m.name : 'Unknown',
            Usage: usage,
            Wastage: wastage,
            ExpectedDeduction: expectedDeduction,
            AssumedActualDeduction: usage,
            Variance: variance
          });

          if (materialId) {
            if (!materialImpact[materialId]) {
              materialImpact[materialId] = { name: m ? m.name : 'Unknown', variance: 0, count: 0 };
            }
            materialImpact[materialId].variance += variance;
            materialImpact[materialId].count += 1;
          }
        }
      }
    }
  }

  console.log("--- PHASE 2 & 3 REPORT ---");
  console.log("AFFECTED LOGS COUNT: " + report.length);
  console.log("MATERIAL VARIANCES (Total un-deducted wastage in DB):");
  for (const matId in materialImpact) {
    console.log(`- ${materialImpact[matId].name}: Leakage of ${materialImpact[matId].variance.toFixed(2)} units across ${materialImpact[matId].count} logs`);
  }

  process.exit(0);
}
main();
