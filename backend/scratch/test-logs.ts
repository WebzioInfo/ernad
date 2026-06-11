import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { productionLogs } from '../src/database/schema';

async function main() {
  const logs = await db.select().from(productionLogs).where(sql`id IN (115, 116, 117, 118, 119, 120)`);
  
  if (logs.length === 0) return console.log('no logs');

  const logIds = logs.map(l => l.id);
  const idsString = logIds.join('|');
  const rmts = await db.execute(sql`
    SELECT rmt.id, rmt.remarks, rmt.quantity_change, rm.name, rm.unit 
    FROM raw_material_transactions rmt
    JOIN raw_materials rm ON rm.id = rmt.material_id
    WHERE rmt.remarks ~ ${'\\(Log #(' + idsString + ')\\)'}
  `);

  console.log(`Log IDs: ${idsString}`);
  console.log(`Regex used: \\(Log #(${idsString})\\)`);
  console.log('RMTS found:');
  console.log(rmts);
  
  const data = logs.map(log => {
    const consumption: any[] = [];
    const pattern = new RegExp(`\\(Log #${log.id}\\)`);
    
    rmts.forEach((rmt: any) => {
      if (pattern.test(rmt.remarks)) {
        const qty = Math.abs(Number(rmt.quantity_change));
        consumption.push({
          name: rmt.name,
          quantity: qty,
          unit: rmt.unit
        });
      }
    });

    return {
      logId: log.id,
      label_usage: log.labelUsage,
      glue_usage_kg: log.glueUsageKg,
      consumption
    };
  });

  console.log('Final mapping:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
