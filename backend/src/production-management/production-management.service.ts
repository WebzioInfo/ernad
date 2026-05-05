import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db/db';
import { 
  productionBatches, changeoverLogs, materialFlows, 
  productionLines, users, batchSnapshots, batchTotals,
  productionLogs, productBrands, products,
  qualityChecks, packagingLogs, dispatchLogs, factories,
  rawMaterials, stockTransactions
} from '../db/schema';
import { eq, and, sql, desc, isNull, inArray } from 'drizzle-orm';

import { ProductionEventsService } from '../events/production.gateway';

@Injectable()
export class ProductionManagementService {
  private readonly logger = new Logger(ProductionManagementService.name);

  constructor(private eventsService: ProductionEventsService) {}

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async startBatch(
    lineId: string, 
    brandId: string, 
    productId: string, 
    shiftId: string, 
    createdBy: string, 
    batchCode?: string,
    remarks?: string, 
    startTime?: string
  ) {
    const factoryId = await this.getFactoryContext();
    
    const result = await db.transaction(async (tx) => {
      // 1. Lock line for update to prevent concurrent starts
      const [line] = await tx.select().from(productionLines).where(eq(productionLines.id, lineId)).for('update');
      if (!line) throw new BadRequestException('Line not found.');
      if (line.status !== 'IDLE') {
        throw new BadRequestException(`Line is ${line.status}. Must be IDLE to start.`);
      }

      // 2. Validate Factory
      const [factory] = await tx.select().from(factories).where(eq(factories.id, factoryId)).limit(1);
      
      // 3. Robust Batch Code Generation (Atomic Sequence)
      let finalBatchCode = batchCode;
      if (!finalBatchCode) {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        // Atomic count with lock
        const [{ count }] = await tx.select({ count: sql<number>`count(*)` })
          .from(productionBatches)
          .where(and(eq(productionBatches.factoryId, factoryId), eq(productionBatches.productionDate, sql`CURRENT_DATE`)))
          .for('share'); // Prevent others from starting same day batches until we insert
        
        const seq = (Number(count) + 1).toString().padStart(3, '0');
        finalBatchCode = `${factory?.code || 'BATCH'}-${dateStr}-${seq}`;
      } else {
        const [existing] = await tx.select().from(productionBatches).where(eq(productionBatches.batchCode, finalBatchCode)).limit(1);
        if (existing) throw new BadRequestException(`Batch code ${finalBatchCode} already exists.`);
      }

      // 4. Create Batch
      const [newBatch] = await tx.insert(productionBatches).values({
        batchCode: finalBatchCode,
        factoryId,
        lineId,
        brandId,
        productId,
        shiftId,
        startTime: startTime ? new Date(startTime) : new Date(),
        status: 'RUNNING',
        createdBy,
        remarks,
      }).returning();

      // 5. Initialize Atomic Totals
      await tx.insert(batchTotals).values({
        batchId: newBatch.id,
        factoryId,
        lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });

      // 6. Update Line Status
      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, lineId));

      this.logger.log(`[Factory: ${factoryId}] Started batch ${finalBatchCode} on line ${lineId}`);
      return newBatch;
    });

    // 7. Emit Events after successful commit
    await this.eventsService.emitLineStatus(lineId, 'RUNNING');
    await this.eventsService.emitProductionUpdated(result.id, lineId);
    
    return result;
  }

  async closeBatch(batchId: string, reqUserId: string, remarks?: string) {
    const factoryId = await this.getFactoryContext();

    const result = await db.transaction(async (tx) => {
      // 1. Get Batch and validate state (LOCK for update to prevent concurrent closes)
      const [batch] = await tx.select().from(productionBatches)
        .where(and(eq(productionBatches.id, batchId), eq(productionBatches.factoryId, factoryId)))
        .for('update');
      
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER'].includes(batch.status)) {
        throw new BadRequestException(`Invalid transition from ${batch.status} to QC_PENDING.`);
      }

      // 2. AUTOMATIC INVENTORY DEDUCTION (ERP Integration)
      const flows = await tx.select().from(materialFlows).where(eq(materialFlows.batchId, batchId));
      
      for (const flow of flows) {
        if (flow.used > 0 || flow.wasted > 0) {
          const totalDeduction = flow.used + flow.wasted;
          
          const [material] = await tx.select().from(rawMaterials)
            .where(and(eq(rawMaterials.name, flow.materialName), eq(rawMaterials.factoryId, factoryId)))
            .for('update');
          
          if (material) {
            // Enterprise Hardening: Block negative stock
            const current = Number(material.currentStock);
            if (current < totalDeduction) {
              throw new BadRequestException(`Insufficient inventory for ${material.name}. Available: ${current}, Required: ${totalDeduction}`);
            }

            await tx.insert(stockTransactions).values({
              materialId: material.id,
              factoryId,
              type: 'OUT',
              quantity: totalDeduction.toString(),
              referenceId: batchId,
              remarks: `Consumption for Batch ${batch.batchCode}`,
              createdAt: new Date(),
            });

            await tx.update(rawMaterials)
              .set({ currentStock: sql`${rawMaterials.currentStock} - ${totalDeduction}` })
              .where(eq(rawMaterials.id, material.id));
          }
        }
      }

      // 3. Update Batch Status
      const [updatedBatch] = await tx.update(productionBatches)
        .set({ 
          status: 'QC_PENDING', 
          endTime: new Date(), 
          updatedBy: reqUserId,
          remarks: remarks ? sql`COALESCE(${productionBatches.remarks}, '') || '\n[CLOSE]: ' || ${remarks}` : productionBatches.remarks
        })
        .where(eq(productionBatches.id, batchId))
        .returning();
      
      // 4. Update Line Status
      await tx.update(productionLines)
        .set({ status: 'IDLE' })
        .where(eq(productionLines.id, batch.lineId));
      
      return updatedBatch;
    });

    // 5. Emit Events
    await this.eventsService.emitLineStatus(result.lineId, 'IDLE');
    await this.eventsService.emitProductionUpdated(result.id, result.lineId);
    
    return result;
  }

  async submitQualityCheck(batchId: string, inspectorId: string, result: 'PASS' | 'FAIL', params: Record<string, any>, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    return await db.transaction(async (tx) => {
      // 1. State Machine Enforcement
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status !== 'QC_PENDING') {
        throw new BadRequestException(`Invalid state for QC: ${batch.status}. Batch must be QC_PENDING.`);
      }

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

      // If QC passed, we might move the batch to COMPLETED
      if (result === 'PASS') {
        await tx.update(productionBatches)
          .set({ status: 'COMPLETED' })
          .where(and(eq(productionBatches.id, batchId), eq(productionBatches.status, 'QC_PENDING')));
      }

      const res = check[0];
      return res;
    });

    await this.eventsService.emitProductionUpdated(batchId, '');
    return result;
  }

  async logPackaging(batchId: string, operatorId: string, packType: string, quantity: number, unitsPerPack: number, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    // 1. State Machine Enforcement
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    if (!batch) throw new BadRequestException('Batch not found.');
    if (!['RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED'].includes(batch.status)) {
       throw new BadRequestException(`Cannot log packaging for batch in ${batch.status} state.`);
    }

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

  async logDispatch(batchId: string, managerId: string, destination: string, quantity: number, vehicle: string, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    // 1. State Machine Enforcement
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    if (!batch) throw new BadRequestException('Batch not found.');
    if (batch.status !== 'COMPLETED' && batch.status !== 'QC_PENDING') {
       throw new BadRequestException('Batch must be at least QC_PENDING or COMPLETED to dispatch.');
    }

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

  async getActiveBatchByLine(lineId: string, factoryId?: string) {
    const conditions = [
      eq(productionBatches.lineId, lineId),
      sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
    ];

    if (factoryId) {
      conditions.push(eq(productionBatches.factoryId, factoryId));
    }

    const results = await db.select({
      batch: productionBatches,
      brand: productBrands,
      product: products,
    })
    .from(productionBatches)
    .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .where(and(...conditions))
    .limit(1);
    
    if (!results.length) return null;
    return { ...results[0].batch, brand: results[0].brand, product: results[0].product };
  }

  async initiateChangeover(batchId: string, toProductId: string, userId: string) {
    const result = await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
      if (!batch) throw new BadRequestException('Batch not found');
      if (batch.status !== 'RUNNING') throw new BadRequestException('Can only initiate changeover from RUNNING state.');

      await tx.update(productionBatches).set({ status: 'CHANGEOVER' }).where(eq(productionBatches.id, batchId));
      
      await tx.update(productionLines).set({ status: 'CHANGEOVER' }).where(eq(productionLines.id, batch.lineId));

      const res = await tx.insert(changeoverLogs).values({
        batchId,
        lineId: batch.lineId,
        fromProductId: batch.productId,
        toProductId,
        startTime: new Date(),
        leftoverMaterials: {},
        wastedMaterials: {},
        createdBy: userId
      }).returning();
      return res[0];
    });

    await this.eventsService.emitLineStatus(result.lineId, 'CHANGEOVER');
    await this.eventsService.emitProductionUpdated(result.batchId, result.lineId);
    return result;
  }

  async completeChangeover(batchId: string, userId: string) {
    const factoryId = await this.getFactoryContext();
    const result = await db.transaction(async (tx) => {
      const [log] = await tx.select().from(changeoverLogs)
        .where(and(eq(changeoverLogs.batchId, batchId), isNull(changeoverLogs.endTime)))
        .limit(1);
      
      if (!log) throw new BadRequestException('No active changeover found.');

      await tx.update(changeoverLogs).set({ endTime: new Date() }).where(eq(changeoverLogs.id, log.id));

      // Close the old batch completely (Skip QC_PENDING for intermediate changeover batches if needed, but here we move to CLOSED)
      await tx.update(productionBatches).set({ status: 'CLOSED', endTime: new Date() }).where(eq(productionBatches.id, batchId));

      // Start NEW batch
      const [oldBatch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
      const [factory] = await tx.select().from(factories).where(eq(factories.id, factoryId)).limit(1);

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchCode = `${factory.code}-${dateStr}-CO-${log.lineId.slice(0, 4).toUpperCase()}`;

      const [newBatch] = await tx.insert(productionBatches).values({
        batchCode,
        factoryId,
        lineId: log.lineId,
        brandId: oldBatch.brandId,
        productId: log.toProductId,
        shiftId: oldBatch.shiftId,
        startTime: new Date(),
        status: 'RUNNING',
        createdBy: userId,
        remarks: `Auto-started after changeover from batch ${batchId}`,
      }).returning();

      await tx.insert(batchTotals).values({
        batchId: newBatch.id,
        factoryId,
        lineId: log.lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
      });

      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, log.lineId));

      return newBatch;
    });

    await this.eventsService.emitLineStatus(result.lineId, 'RUNNING');
    await this.eventsService.emitProductionUpdated(result.id, result.lineId);
    return result;
  }

  async toggleMaintenance(lineId: string, userId: string) {
     const factoryId = await this.getFactoryContext();
     const [line] = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
     if (!line) throw new BadRequestException('Line not found');

     const newStatus = line.status === 'MAINTENANCE' ? 'IDLE' : 'MAINTENANCE';
     if (newStatus === 'MAINTENANCE' && line.status === 'RUNNING') {
        throw new BadRequestException('Stop production before maintenance.');
     }

     const [updated] = await db.update(productionLines)
       .set({ status: newStatus, updatedAt: new Date() })
       .where(and(eq(productionLines.id, lineId), eq(productionLines.factoryId, factoryId)))
       .returning();
     
     await this.eventsService.emitLineStatus(lineId, newStatus);
     return updated;
  }

  async getBatches(limit = 50) {
    const factoryId = await this.getFactoryContext();
    const conditions = [];
    if (factoryId) {
      conditions.push(eq(productionBatches.factoryId, factoryId));
    }

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
    .where(and(...conditions))
    .orderBy(desc(productionBatches.startTime))
    .limit(limit);
  }

  async getLifecycleLogs(type?: 'qc' | 'packaging' | 'dispatch') {
    const factoryId = await this.getFactoryContext();
    if (type === 'qc') {
      const q = db.select().from(qualityChecks);
      if (factoryId) q.where(eq(qualityChecks.factoryId, factoryId));
      return await q.orderBy(desc(qualityChecks.checkedAt)).limit(50);
    } else if (type === 'packaging') {
      const q = db.select().from(packagingLogs);
      if (factoryId) q.where(eq(packagingLogs.factoryId, factoryId));
      return await q.orderBy(desc(packagingLogs.createdAt)).limit(50);
    } else {
      const q = db.select().from(dispatchLogs);
      if (factoryId) q.where(eq(dispatchLogs.factoryId, factoryId));
      return await q.orderBy(desc(dispatchLogs.dispatchedAt)).limit(50);
    }
  }

  async getActiveBatch(lineId: string) {
    const results = await db.select({
      batch: productionBatches,
      brand: productBrands,
      product: products
    })
    .from(productionBatches)
    .innerJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .innerJoin(products, eq(productionBatches.productId, products.id))
    .where(and(
      eq(productionBatches.lineId, lineId),
      inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER'])
    ))
    .orderBy(desc(productionBatches.startTime))
    .limit(1);

    return results[0] || null;
  }
}
