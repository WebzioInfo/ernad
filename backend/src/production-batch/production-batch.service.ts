import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db/drizzle.provider';
import { productionBatches, changeoverLogs, materialFlows } from '../db/drizzle-schema';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class ProductionBatchService {
  private readonly logger = new Logger(ProductionBatchService.name);

  async startBatch(lineId: string, brandId: string, productId: string, shiftId: string) {
    // Check if another batch is running on this line
    const activeBatch = await db.select().from(productionBatches)
      .where(and(eq(productionBatches.lineId, lineId), eq(productionBatches.status, 'RUNNING')))
      .limit(1);

    if (activeBatch.length > 0) {
      throw new BadRequestException('A batch is already running on this line.');
    }

    const newBatch = await db.insert(productionBatches).values({
      lineId,
      brandId,
      productId,
      shiftId,
      startTime: new Date(),
      status: 'RUNNING',
    }).returning();

    this.logger.log(`Started new batch ${newBatch[0].id} on line ${lineId}`);
    return newBatch[0];
  }

  async initiateChangeover(batchId: string, toProductId: string, userId: string) {
    // 1. Mark current batch as CHANGEOVER
    await db.update(productionBatches)
      .set({ status: 'CHANGEOVER', endTime: new Date() })
      .where(eq(productionBatches.id, batchId));

    // 2. Fetch current batch details
    const batch = (await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)))[0];

    // 3. Calculate materials left over (This is an aggregate of material_flows)
    const materials = await db.execute(sql`
      SELECT material_name, (SUM(issued) - SUM(used) - SUM(wasted)) as leftover
      FROM material_flows
      WHERE batch_id = ${batchId}
      GROUP BY material_name
    `);

    const leftoverMaterials = materials.rows.reduce((acc, row) => {
        if (Number(row.leftover) > 0) acc[row.material_name as string] = row.leftover;
        return acc;
    }, {});

    // 4. Record changeover
    const changeover = await db.insert(changeoverLogs).values({
      batchId,
      lineId: batch.lineId,
      fromProductId: batch.productId,
      toProductId,
      startTime: new Date(),
      leftoverMaterials, // JSON of things like { "Preforms": 500, "Labels": 800 }
      wastedMaterials: {}, // This would be populated by operator inputs during changeover
      createdBy: userId
    }).returning();

    this.logger.log(`Initiated changeover for batch ${batchId} to product ${toProductId}`);
    return changeover[0];
  }

  async closeBatch(batchId: string) {
    await db.update(productionBatches)
      .set({ status: 'CLOSED', endTime: new Date() })
      .where(eq(productionBatches.id, batchId));
      
    this.logger.log(`Closed batch ${batchId}`);
  }
}
