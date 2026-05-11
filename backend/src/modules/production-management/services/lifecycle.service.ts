import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionBatches, batchTotals, productionLines, factories,
  qualityChecks, packagingLogs, dispatchLogs, userRoles, roles, operatorSessions,
  finishedGoodsInventory, inventoryStock, warehouseLocations, inventoryTransactions
} from '../../../database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { OperatorSessionService } from '../../operator-session/operator-session.service';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private sessionService: OperatorSessionService
  ) {}

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async closeBatch(batchId: string, reqUserId: string, remarks?: string, endTime?: string, materialReturn?: any) {
    const factoryId = await this.getFactoryContext();

    const result = await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches)
        .where(and(eq(productionBatches.id, batchId), eq(productionBatches.factoryId, factoryId)))
        .for('update');
      
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER'].includes(batch.status)) {
        throw new BadRequestException(`Invalid transition from ${batch.status} to QC_PENDING.`);
      }

      const closerRoles = await tx.select({ slug: roles.slug })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, reqUserId));

      const [updatedBatch] = await tx.update(productionBatches)
        .set({ 
          status: 'QC_PENDING', 
          endTime: endTime ? new Date(endTime) : new Date(), 
          updatedBy: reqUserId,
          remarks: remarks ? sql`COALESCE(${productionBatches.remarks}, '') || '\n[CLOSE]: ' || ${remarks}` : productionBatches.remarks,
          materialReturn: materialReturn || null
        })
        .where(eq(productionBatches.id, batchId))
        .returning();
      
      await tx.update(productionLines)
        .set({ status: 'IDLE' })
        .where(eq(productionLines.id, batch.lineId));
      
      const boundSessions = await tx.select().from(operatorSessions).where(and(eq(operatorSessions.batchId, batchId), eq(operatorSessions.isActive, true)));
      for (const session of boundSessions) {
        await this.sessionService.endSession(session.userId, reqUserId, 'batch_closed');
      }

      // ── HANDLE MATERIAL RETURNS ──
      if (materialReturn) {
        for (const [stockId, qty] of Object.entries(materialReturn)) {
          const quantity = Number(qty);
          if (isNaN(quantity) || quantity <= 0) continue;

          await tx.update(inventoryStock)
            .set({ quantity: sql`${inventoryStock.quantity} + ${quantity}`, updatedAt: new Date() })
            .where(eq(inventoryStock.id, stockId));

          await tx.insert(inventoryTransactions).values({
            stockId: stockId,
            type: 'IN',
            quantityChange: quantity.toString(),
            balanceAfter: '0', 
            remarks: `Material Return from Batch ${batch.batchCode}`,
            referenceId: batchId,
            createdAt: new Date(),
          });
        }
      }

      return updatedBatch;
    });

    await this.eventsService.emitLineStatus(result.lineId, 'IDLE');
    await this.eventsService.emitProductionUpdated(result.id, result.lineId);
    
    return result;
  }

  async closeShift(factoryId: string, shiftId: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Find all active batches for this shift
      const activeBatchesList = await tx.select()
        .from(productionBatches)
        .where(and(
          eq(productionBatches.factoryId, factoryId),
          eq(productionBatches.shiftId, shiftId),
          sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
        ));

      // 2. Transition them to QC_PENDING
      for (const batch of activeBatchesList) {
        await this.closeBatch(batch.id, userId, 'Shift Auto-Close');
      }

      this.logger.log(`Shift ${shiftId} closed. ${activeBatchesList.length} batches transitioned.`);
      return { closedBatches: activeBatchesList.length };
    });
  }

  async submitQualityCheck(batchId: string, inspectorId: string, result: 'PASS' | 'FAIL', params: Record<string, any>, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    return await db.transaction(async (tx) => {
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

      if (result === 'PASS') {
        await tx.update(productionBatches)
          .set({ status: 'COMPLETED' })
          .where(and(eq(productionBatches.id, batchId), eq(productionBatches.status, 'QC_PENDING')));

        // ── GENERATE FINISHED GOODS ──
        const [totals] = await tx.select().from(batchTotals).where(eq(batchTotals.batchId, batchId));
        const [warehouse] = await tx.select().from(warehouseLocations)
          .where(and(eq(warehouseLocations.factoryId, factoryId), eq(warehouseLocations.type, 'FINISHED_GOODS')))
          .limit(1);

        if (warehouse && totals.packingTotal > 0) {
          await tx.insert(finishedGoodsInventory).values({
            factoryId,
            productId: batch.productId,
            warehouseId: warehouse.id,
            quantity: totals.packingTotal,
            status: 'AVAILABLE',
            updatedAt: new Date(),
          }).onConflictDoUpdate({
            target: [finishedGoodsInventory.productId, finishedGoodsInventory.warehouseId],
            set: { 
              quantity: sql`${finishedGoodsInventory.quantity} + ${totals.packingTotal}`,
              updatedAt: new Date()
            }
          });
        }
      }

      return check[0];
    });
  }

  async logPackaging(batchId: string, operatorId: string, packType: string, quantity: number, unitsPerPack: number, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED'].includes(batch.status)) {
         throw new BadRequestException(`Cannot log packaging for batch in ${batch.status} state.`);
      }

      const res = await tx.insert(packagingLogs).values({
        batchId,
        factoryId,
        operatorId,
        packType,
        quantity,
        unitsPerPack,
        remarks: remarks,
        createdAt: new Date(),
      }).returning();

      await tx.update(batchTotals)
        .set({ packingTotal: sql`${batchTotals.packingTotal} + ${quantity * unitsPerPack}` })
        .where(eq(batchTotals.batchId, batchId));

      return res[0];
    });
  }

  async logDispatch(batchId: string, managerId: string, destination: string, quantity: number, vehicle: string, remarks?: string) {
    const factoryId = await this.getFactoryContext();
    
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status !== 'COMPLETED' && batch.status !== 'QC_PENDING') {
         throw new BadRequestException('Batch must be at least QC_PENDING or COMPLETED to dispatch.');
      }

      const res = await tx.insert(dispatchLogs).values({
        batchId,
        factoryId,
        dispatchManagerId: managerId,
        destination,
        quantity,
        vehicleNumber: vehicle,
        remarks: remarks,
        dispatchedAt: new Date(),
      }).returning();
      
      return res[0];
    });
  }

  async getLifecycleLogs(type?: 'qc' | 'packaging' | 'dispatch') {
    const factoryId = await this.getFactoryContext();
    if (type === 'qc') {
      return await db.select().from(qualityChecks)
        .where(eq(qualityChecks.factoryId, factoryId))
        .orderBy(desc(qualityChecks.checkedAt)).limit(50);
    } else if (type === 'packaging') {
      return await db.select().from(packagingLogs)
        .where(eq(packagingLogs.factoryId, factoryId))
        .orderBy(desc(packagingLogs.createdAt)).limit(50);
    } else {
      return await db.select().from(dispatchLogs)
        .where(eq(dispatchLogs.factoryId, factoryId))
        .orderBy(desc(dispatchLogs.dispatchedAt)).limit(50);
    }
  }
}
