import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { db } from '../src/database/db';
import { productionLines, productionBatches, productionLogs, rawMaterialTransactions, rawMaterials } from '../src/database/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Find Line 2
  const lines = await db.select().from(productionLines);
  const line2 = lines.find(l => l.name.toLowerCase().includes('line 2') || l.name.includes('2'));
  if (!line2) {
    console.error('Line 2 not found!');
    await app.close();
    return;
  }

  const startDate = new Date('2026-06-08T00:00:00.000Z');
  const endDate = new Date('2026-06-15T23:59:59.000Z');

  const batches = await db.select()
    .from(productionBatches)
    .where(and(
      eq(productionBatches.lineId, line2.id),
      inArray(productionBatches.status, ['COMPLETED', 'CLOSED']),
      isNull(productionBatches.deletedAt),
      sql`date(${productionBatches.endTime}) BETWEEN ${startDate.toISOString().split('T')[0]} AND ${endDate.toISOString().split('T')[0]}`
    ));

  const batchIds = batches.map(b => b.id);
  console.log(`Line 2 completed/closed batch IDs:`, batchIds);

  if (batchIds.length === 0) {
    console.log('No batches found');
    await app.close();
    return;
  }

  // 1. Query logs
  const logs = await db.select({
    id: productionLogs.id,
    batchId: productionLogs.batchId,
    station: productionLogs.station,
    primaryCount: productionLogs.primaryCount,
    wastageCount: productionLogs.wastageCount,
    capWastage: productionLogs.capWastage,
    bottleLeakage: productionLogs.bottleLeakage,
    damagedLabelWeight: productionLogs.damagedLabelWeight,
    shrinkWastageKg: productionLogs.shrinkWastageKg
  })
  .from(productionLogs)
  .where(and(
    inArray(productionLogs.batchId, batchIds),
    isNull(productionLogs.deletedAt),
    sql`status NOT IN ('DRAFT', 'REJECTED')`
  ));

  const logIds = logs.map(l => l.id);
  console.log(`Found ${logs.length} logs. Log IDs:`, logIds);

  // 2. Fetch raw material transactions
  const txs = await db.select({
    id: rawMaterialTransactions.id,
    materialId: rawMaterialTransactions.materialId,
    materialName: rawMaterials.name,
    materialType: rawMaterials.materialType,
    unit: rawMaterials.unit,
    quantityChange: rawMaterialTransactions.quantityChange,
    remarks: rawMaterialTransactions.remarks
  })
  .from(rawMaterialTransactions)
  .innerJoin(rawMaterials, eq(rawMaterialTransactions.materialId, rawMaterials.id))
  .where(eq(rawMaterialTransactions.type, 'CONSUMPTION'));

  const matched = txs.filter(tx => tx.remarks && logIds.some(id => tx.remarks?.includes(`(Log #${id})`)));
  console.log(`Matched transactions: ${matched.length}`);

  // 3. Aggregate
  const aggregationMap = new Map<string, {
    materialName: string;
    materialCode: string;
    unit: string;
    totalConsumed: number;
    totalWastage: number;
  }>();

  matched.forEach(tx => {
    // extract log ID
    const logIdMatch = tx.remarks?.match(/\(Log #(\d+)\)/);
    const logId = logIdMatch ? Number(logIdMatch[1]) : null;
    const log = logs.find(l => l.id === logId);

    let wastage = 0;
    if (log) {
      if (tx.materialType === 'PREFORM') {
        wastage = Number(log.bottleLeakage || 0);
        if (wastage === 0) wastage = Number(log.wastageCount || 0);
      } else if (tx.materialType === 'CAP') {
        wastage = Number(log.capWastage || 0);
      } else if (tx.materialType === 'LABEL') {
        wastage = Number(log.damagedLabelWeight || 0);
        if (wastage === 0) wastage = Number(log.wastageCount || 0);
      } else if (tx.materialType === 'SHRINK') {
        wastage = Number(log.shrinkWastageKg || 0);
      } else {
        wastage = Number(log.wastageCount || 0);
      }
    }

    const key = tx.materialId;
    const consumed = Math.abs(Number(tx.quantityChange || 0));

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        materialName: tx.materialName,
        materialCode: tx.materialId.slice(0, 8), // use short ID or SKU
        unit: tx.unit,
        totalConsumed: 0,
        totalWastage: 0
      });
    }

    const entry = aggregationMap.get(key)!;
    entry.totalConsumed += consumed;
    entry.totalWastage += wastage;
  });

  const list = Array.from(aggregationMap.values()).map(item => {
    const variance = item.totalConsumed > 0 ? (item.totalWastage / item.totalConsumed) * 100 : 0;
    return {
      ...item,
      variance: Math.round(variance * 100) / 100
    };
  });

  console.log(`\nAggregated Material Wastage List (${list.length} items):`);
  console.log(JSON.stringify(list, null, 2));

  await app.close();
}

bootstrap().catch(console.error);
