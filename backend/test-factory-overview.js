const { db } = require('./src/database/db');
const { productionLogs, batchTotals, productionBatches, downtimeLogs, inventoryStock, productionLines, products, userLines } = require('./src/database/schema');
const { eq, and, sql, desc, inArray, isNull } = require('drizzle-orm');

async function testOverview() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Today start:', today);

    const [productionToday] = await db.select({
      blowing: sql`COALESCE(SUM(CASE WHEN ${productionLogs.station}::text = 'BLOWING' THEN ${productionLogs.primaryCount} ELSE 0 END), 0)`,
      filling: sql`COALESCE(SUM(CASE WHEN ${productionLogs.station}::text = 'FILLING' THEN ${productionLogs.primaryCount} ELSE 0 END), 0)`,
      packing: sql`COALESCE(SUM(CASE WHEN ${productionLogs.station}::text = 'PACKING' THEN ${productionLogs.primaryCount} ELSE 0 END), 0)`,
      rejection: sql`COALESCE(SUM(${productionLogs.wastageCount}), 0)`
    })
    .from(productionLogs)
    .where(and(
      sql`${productionLogs.loggedAt} >= ${today}`, 
      isNull(productionLogs.deletedAt)
    ));
    console.log('productionToday:', productionToday);

    const [{ activeOperatorsCount }] = await db.select({ 
      activeOperatorsCount: sql`count(distinct ${userLines.userId})` 
    }).from(userLines);
    console.log('activeOperatorsCount:', activeOperatorsCount);

    const [{ totalDowntimeToday }] = await db.select({
      totalDowntimeToday: sql`COALESCE(SUM(${downtimeLogs.durationMinutes}), 0)`
    }).from(downtimeLogs)
    .where(and(
      sql`${downtimeLogs.startTime} >= ${today}`,
      isNull(downtimeLogs.deletedAt)
    ));
    console.log('totalDowntimeToday:', totalDowntimeToday);

    const activeBatches = await db.select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      product: products.name,
      line: productionLines.name,
      status: productionBatches.status,
      startTime: productionBatches.startTime,
      targetQuantity: productionBatches.targetQuantity,
      packingTotal: batchTotals.packingTotal,
      totalDowntimeMins: sql`COALESCE((
        SELECT SUM(dl.duration_minutes) 
        FROM downtime_logs dl
        WHERE dl.batch_id = production_batches.id 
        AND dl.deleted_at IS NULL
      ), 0)`
    })
    .from(productionBatches)
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
    .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
    .where(and(
      inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER']),
      isNull(productionBatches.deletedAt)
    ));
    console.log('activeBatches:', activeBatches);
  } catch (err) {
    console.error('Error:', err);
  }
}

testOverview();
