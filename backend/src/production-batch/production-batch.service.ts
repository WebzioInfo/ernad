import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db/db';
import { 
  productionBatches, changeoverLogs, materialFlows, 
  productionLines, users, batchSnapshots, batchTotals,
  factoryLogs, productBrands, products
} from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

@Injectable()
export class ProductionBatchService {
  private readonly logger = new Logger(ProductionBatchService.name);

  async startBatch(lineId: string, brandId: string, productId: string, shiftId: string) {
    return await db.transaction(async (tx) => {
      // Check if another batch is running on this line
      const activeBatch = await tx.select().from(productionBatches)
        .where(and(eq(productionBatches.lineId, lineId), eq(productionBatches.status, 'RUNNING')))
        .limit(1);

      if (activeBatch.length > 0) {
        throw new BadRequestException('A batch is already running on this line.');
      }

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchCode = `B-${dateStr}-${lineId.slice(0, 4).toUpperCase()}`;

      const newBatch = await tx.insert(productionBatches).values({
        batchCode,
        lineId,
        brandId,
        productId,
        shiftId,
        startTime: new Date(),
        status: 'RUNNING',
      }).returning();

      // Initialize Atomic Totals for MES flow validation
      await tx.insert(batchTotals).values({
        batchId: newBatch[0].id,
        lineId: lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });


      this.logger.log(`Started new batch ${newBatch[0].id} on line ${lineId}`);
      
      // Update Line Status
      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, lineId));
      
      return newBatch[0];
    });
  }


  async getActiveBatchByLine(lineId: string) {
    const results = await db.select({
      batch: productionBatches,
      brand: productBrands,
      product: products,
    })
    .from(productionBatches)
    .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .innerJoin(products, eq(productionBatches.productId, products.id))
    .where(and(eq(productionBatches.lineId, lineId), eq(productionBatches.status, 'RUNNING')))
    .limit(1);
    
    if (!results.length) return null;
    
    return {
      ...results[0].batch,
      brand: results[0].brand,
      product: results[0].product
    };
  }

  async initiateChangeover(batchId: string, toProductId: string, userId: string) {
    // 1. Mark current batch as CHANGEOVER
    await db.update(productionBatches)
      .set({ status: 'CHANGEOVER', endTime: new Date() })
      .where(eq(productionBatches.id, batchId));

    // 2. Fetch current batch details
    const batch = (await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)))[0];

    // 3. Calculate materials left over (This is an aggregate of material_flows)
    const materials = (await db.execute(sql`
      SELECT material_name, (SUM(issued) - SUM(used) - SUM(wasted)) as leftover
      FROM material_flows
      WHERE batch_id = ${batchId}
      GROUP BY material_name
    `)) as any[];

    const leftoverMaterials = materials.reduce((acc, row) => {
        if (Number(row.leftover) > 0) acc[row.material_name as string] = row.leftover;
        return acc;
    }, {});

    // 4. Record Snapshot (The "Memory" of the line)
    await db.insert(batchSnapshots).values({
      batchId,
      snapshotType: 'CHANGEOVER_START',
      data: leftoverMaterials,
      recordedAt: new Date()
    });

    // 5. Record changeover
    const changeover = await db.insert(changeoverLogs).values({
      batchId,
      lineId: batch.lineId,
      fromProductId: batch.productId,
      toProductId,
      startTime: new Date(),
      leftoverMaterials, 
      wastedMaterials: {}, 
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

  async createHistoricalBatch(dto: { 
    batchCode: string; 
    productionDate: Date; 
    lineId: string; 
    brandId: string; 
    productId: string; 
    shiftId: string 
  }) {
    return await db.transaction(async (tx) => {
      const newBatch = await tx.insert(productionBatches).values({
        batchCode: dto.batchCode,
        productionDate: dto.productionDate,
        lineId: dto.lineId,
        brandId: dto.brandId,
        productId: dto.productId,
        shiftId: dto.shiftId,
        startTime: dto.productionDate,
        endTime: dto.productionDate,
        status: 'CLOSED', // Historical batches are usually already finished
      }).returning();

      await tx.insert(batchTotals).values({
        batchId: newBatch[0].id,
        lineId: dto.lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });

      return newBatch[0];
    });
  }
}

