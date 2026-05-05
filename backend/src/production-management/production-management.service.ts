import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db/db';
import { 
  productionBatches, changeoverLogs, materialFlows, 
  productionLines, users, batchSnapshots, batchTotals,
  productionLogs, productBrands, products,
  qualityChecks, packagingLogs, dispatchLogs
} from '../db/schema';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';

@Injectable()
export class ProductionManagementService {
  private readonly logger = new Logger(ProductionManagementService.name);

  // Phase 4: Simple Role Helpers
  private async getUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user;
  }

  async canPerformQC(userId: string) {
    const user = await this.getUser(userId);
    return user && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role);
  }

  async canStartBatch(userId: string) {
    const user = await this.getUser(userId);
    return user && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role);
  }

  async startBatch(factoryId: string, lineId: string, brandId: string, productId: string, shiftId: string, createdBy?: string, remarks?: string, startTime?: string) {
    return await db.transaction(async (tx) => {
      // End any open changeover for this line
      await tx.update(changeoverLogs)
        .set({ endTime: new Date() })
        .where(and(eq(changeoverLogs.lineId, lineId), isNull(changeoverLogs.endTime)));

      // Check if another batch is running on this line
      const activeBatch = await tx.select().from(productionBatches)
        .where(and(
          eq(productionBatches.lineId, lineId), 
          eq(productionBatches.factoryId, factoryId),
          eq(productionBatches.status, 'RUNNING')
        ))
        .limit(1);

      if (activeBatch.length > 0) {
        throw new BadRequestException('A batch is already running on this line.');
      }

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchCode = `B-${dateStr}-${lineId.slice(0, 4).toUpperCase()}`;

      const newBatch = await tx.insert(productionBatches).values({
        batchCode,
        factoryId,
        lineId,
        brandId,
        productId,
        shiftId,
        startTime: startTime ? new Date(startTime) : new Date(),
        status: 'RUNNING',
        createdBy: createdBy,
        remarks: remarks,
      }).returning();

      // Initialize Atomic Totals
      await tx.insert(batchTotals).values({
        batchId: newBatch[0].id,
        factoryId,
        lineId: lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });

      this.logger.log(`[Factory: ${factoryId}] Started batch ${newBatch[0].id} on line ${lineId}`);
      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, lineId));
      
      return newBatch[0];
    });
  }

  async submitQualityCheck(factoryId: string, batchId: string, inspectorId: string, result: 'PASS' | 'FAIL', params: any, remarks?: string) {
    return await db.transaction(async (tx) => {
      const check = await tx.insert(qualityChecks).values({
        batchId,
        factoryId,
        inspectorId,
        checkType: 'PRODUCTION_SAMPLE',
        result,
        parameters: params,
        remarks: remarks,
        checkedAt: new Date(),
      }).returning();

      // If QC passed, we might move the batch to COMPLETED if it was closed
      if (result === 'PASS') {
        await tx.update(productionBatches)
          .set({ status: 'COMPLETED' })
          .where(and(eq(productionBatches.id, batchId), eq(productionBatches.status, 'QC_PENDING')));
      }

      return check[0];
    });
  }

  async logPackaging(factoryId: string, batchId: string, operatorId: string, packType: string, quantity: number, unitsPerPack: number, remarks?: string) {
    return await db.insert(packagingLogs).values({
      batchId,
      factoryId,
      operatorId,
      packType,
      quantity,
      unitsPerPack,
      remarks: remarks,
      createdAt: new Date(),
    }).returning();
  }

  async logDispatch(factoryId: string, batchId: string, managerId: string, destination: string, quantity: number, vehicle: string, remarks?: string) {
    return await db.insert(dispatchLogs).values({
      batchId,
      factoryId,
      dispatchManagerId: managerId,
      destination,
      quantity,
      vehicleNumber: vehicle,
      remarks: remarks,
      dispatchedAt: new Date(),
    }).returning();
  }

  async closeBatch(factoryId: string, batchId: string, reqUserId?: string, remarks?: string) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx.update(productionBatches)
        .set({ 
          status: 'QC_PENDING', 
          endTime: new Date(), 
          updatedBy: reqUserId,
          remarks: remarks ? sql`COALESCE(${productionBatches.remarks}, '') || '\n[CLOSE]: ' || ${remarks}` : productionBatches.remarks
        })
        .where(and(eq(productionBatches.id, batchId), eq(productionBatches.factoryId, factoryId)))
        .returning();
      
      if (batch) {
        await tx.update(productionLines)
          .set({ status: 'IDLE' })
          .where(eq(productionLines.id, batch.lineId));
      }
      
      this.logger.log(`[Factory: ${factoryId}] Batch ${batchId} moved to QC_PENDING.`);
      return batch;
    });
  }

  async getActiveBatchByLine(factoryId: string, lineId: string) {
    const results = await db.select({
      batch: productionBatches,
      brand: productBrands,
      product: products,
    })
    .from(productionBatches)
    .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .where(and(
      eq(productionBatches.lineId, lineId), 
      eq(productionBatches.factoryId, factoryId),
      sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
    ))
    .limit(1);
    
    if (!results.length) return null;
    return { ...results[0].batch, brand: results[0].brand, product: results[0].product };
  }

  async initiateChangeover(batchId: string, toProductId: string, userId: string) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
      if (!batch) throw new BadRequestException('Batch not found');

      await tx.update(productionBatches).set({ status: 'CHANGEOVER', endTime: new Date() }).where(eq(productionBatches.id, batchId));
      
      // Sync line status
      await tx.update(productionLines).set({ status: 'CHANGEOVER' }).where(eq(productionLines.id, batch.lineId));

      return await tx.insert(changeoverLogs).values({
        batchId,
        lineId: batch.lineId,
        fromProductId: batch.productId,
        toProductId,
        startTime: new Date(),
        leftoverMaterials: {},
        wastedMaterials: {},
        createdBy: userId
      }).returning();
    });
  }

  async completeChangeover(factoryId: string, batchId: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Get the changeover log
      const [log] = await tx.select().from(changeoverLogs)
        .where(and(eq(changeoverLogs.batchId, batchId), isNull(changeoverLogs.endTime)))
        .limit(1);
      
      if (!log) throw new BadRequestException('No active changeover found for this batch');

      // 2. Mark changeover as complete
      await tx.update(changeoverLogs).set({ endTime: new Date() }).where(eq(changeoverLogs.id, log.id));

      // 3. Mark old batch as CLOSED
      await tx.update(productionBatches).set({ status: 'CLOSED' }).where(eq(productionBatches.id, batchId));

      // 4. Start NEW batch for the new product
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchCode = `B-${dateStr}-${log.lineId.slice(0, 4).toUpperCase()}-CO`;

      const [oldBatch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);

      const [newBatch] = await tx.insert(productionBatches).values({
        batchCode,
        factoryId: oldBatch.factoryId,
        lineId: log.lineId,
        brandId: oldBatch.brandId,
        productId: log.toProductId,
        shiftId: oldBatch.shiftId,
        startTime: new Date(),
        status: 'RUNNING',
        createdBy: userId,
        remarks: `Auto-started after changeover from batch ${batchId}`,
      }).returning();

      // 5. Initialize Totals
      await tx.insert(batchTotals).values({
        batchId: newBatch.id,
        factoryId: oldBatch.factoryId,
        lineId: log.lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });

      // 6. Update Line Status back to RUNNING
      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, log.lineId));

      return newBatch;
    });
  }

  async toggleMaintenance(factoryId: string, lineId: string, userId: string) {
     const [line] = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
     if (!line) throw new BadRequestException('Line not found');

     const newStatus = line.status === 'MAINTENANCE' ? 'IDLE' : 'MAINTENANCE';
     
     if (newStatus === 'MAINTENANCE' && line.status === 'RUNNING') {
        throw new BadRequestException('Cannot put a running line into maintenance. Stop production first.');
     }

     return await db.update(productionLines)
       .set({ status: newStatus, updatedAt: new Date() })
       .where(and(eq(productionLines.id, lineId), eq(productionLines.factoryId, factoryId)))
       .returning();
  }

  async forceResetLine(factoryId: string, lineId: string) {
    await db.transaction(async (tx) => {
      await tx.update(productionLines)
        .set({ status: 'IDLE' })
        .where(and(eq(productionLines.id, lineId), eq(productionLines.factoryId, factoryId)));
      
      await tx.update(productionBatches)
        .set({ status: 'CLOSED', endTime: new Date() })
        .where(and(
          eq(productionBatches.lineId, lineId), 
          eq(productionBatches.factoryId, factoryId),
          sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
        ));
      
      await tx.update(changeoverLogs)
        .set({ endTime: new Date() })
        .where(and(eq(changeoverLogs.lineId, lineId), isNull(changeoverLogs.endTime)));
    });
  }

  async createHistoricalBatch(dto: any) {
    // Simple implementation for backward compatibility
    return await db.insert(productionBatches).values({
      ...dto,
      startTime: new Date(dto.startTime || Date.now()),
      endTime: new Date(dto.endTime || Date.now()),
      status: 'COMPLETED'
    }).returning();
  }

  async getBatches(factoryId: string, limit = 50) {
    return await db.select({
      batch: productionBatches,
      line: productionLines,
      product: products,
      brand: productBrands,
    })
    .from(productionBatches)
    .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
    .innerJoin(products, eq(productionBatches.productId, products.id))
    .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .where(eq(productionBatches.factoryId, factoryId))
    .orderBy(desc(productionBatches.startTime))
    .limit(limit);
  }

  async getLifecycleLogs(factoryId: string, type: 'qc' | 'packaging' | 'dispatch') {
    if (type === 'qc') {
      return await db.select().from(qualityChecks).where(eq(qualityChecks.factoryId, factoryId)).orderBy(desc(qualityChecks.checkedAt)).limit(50);
    } else if (type === 'packaging') {
      return await db.select().from(packagingLogs).where(eq(packagingLogs.factoryId, factoryId)).orderBy(desc(packagingLogs.createdAt)).limit(50);
    } else {
      return await db.select().from(dispatchLogs).where(eq(dispatchLogs.factoryId, factoryId)).orderBy(desc(dispatchLogs.dispatchedAt)).limit(50);
    }
  }
}

