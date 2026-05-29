import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionBatches, batchTotals, productionLines,
  packagingLogs, dispatchLogs, userRoles, roles, operatorSessions,
  finishedGoodsInventory, inventoryStock, warehouseLocations, inventoryTransactions
} from '../../../database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private sessionService: OperatorSessionsService
  ) {}

  async closeBatch(batchId: string, reqUserId: string, remarks?: string, endTime?: string, materialReturn?: any) {
    const result = await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches)
        .where(eq(productionBatches.id, batchId))
        .for('update');
      
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER', 'WAITING_APPROVAL', 'APPROVED', 'COMPLETED'].includes(batch.status)) {
        throw new BadRequestException(`Cannot close batch in status ${batch.status}.`);
      }

      const [updatedBatch] = await tx.update(productionBatches)
        .set({ 
          status: 'CLOSED', 
          endTime: endTime ? new Date(endTime) : batch.endTime || new Date(), 
          closedBy: reqUserId,
          closedAt: new Date(),
          isLocked: true,
          updatedBy: reqUserId,
          remarks: remarks ? sql`COALESCE(${productionBatches.remarks}, '') || '\n[FINAL_CLOSE]: ' || ${remarks}` : productionBatches.remarks,
          materialReturn: materialReturn || batch.materialReturn
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

          // RED TEAM FIX: Calculate real balanceAfter instead of hardcoding 0
          const [stock] = await tx.select().from(inventoryStock)
            .where(eq(inventoryStock.id, stockId))
            .for('update');
          
          if (!stock) {
            this.logger.error(`Stock item ${stockId} missing during material return for batch ${batchId}`);
            continue;
          }

          const currentQty = Number(stock.quantity);
          const newQty = currentQty + quantity;

          await tx.update(inventoryStock)
            .set({ quantity: newQty.toString(), updatedAt: new Date() })
            .where(eq(inventoryStock.id, stockId));

          await tx.insert(inventoryTransactions).values({
            stockId: stockId,
            type: 'RETURN',
            quantityChange: quantity.toString(),
            balanceAfter: newQty.toString(), 
            remarks: `Material Return from Batch ${batch.batchCode}`,
            referenceId: batchId,
            performedBy: reqUserId,
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

  async requestApproval(batchId: string, userId: string) {
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId));
    if (!batch) throw new BadRequestException('Batch not found.');
    
    return await db.update(productionBatches)
      .set({ status: 'WAITING_APPROVAL', updatedAt: new Date(), updatedBy: userId })
      .where(eq(productionBatches.id, batchId))
      .returning();
  }

  async approveBatch(batchId: string, userId: string) {
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId));
    if (!batch) throw new BadRequestException('Batch not found.');
    
    return await db.update(productionBatches)
      .set({ status: 'APPROVED', updatedAt: new Date(), updatedBy: userId })
      .where(eq(productionBatches.id, batchId))
      .returning();
  }

  async adjustBatchTime(batchId: string, userId: string, startTime?: string, endTime?: string, reason?: string) {
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId));
    if (!batch) throw new BadRequestException('Batch not found.');

    const updateData: any = { updatedAt: new Date(), updatedBy: userId };
    if (startTime) {
      updateData.adjustedStartTime = new Date(startTime);
      updateData.adjustedBy = userId;
    }
    if (endTime) {
      updateData.endTime = new Date(endTime);
    }
    if (reason) {
      updateData.remarks = sql`COALESCE(${productionBatches.remarks}, '') || '\n[ADJUSTMENT]: ' || ${reason}`;
    }

    return await db.update(productionBatches)
      .set(updateData)
      .where(eq(productionBatches.id, batchId))
      .returning();
  }

  async closeShift(shiftId: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Find all active batches for this shift
      const activeBatchesList = await tx.select()
        .from(productionBatches)
        .where(and(
          eq(productionBatches.shiftId, shiftId),
          sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
        ));

      // 2. Transition them to WAITING_APPROVAL
      for (const batch of activeBatchesList) {
        await tx.update(productionBatches)
          .set({ status: 'WAITING_APPROVAL', updatedAt: new Date(), updatedBy: userId })
          .where(eq(productionBatches.id, batch.id));
      }

      this.logger.log(`Shift ${shiftId} closed. ${activeBatchesList.length} batches transitioned to WAITING_APPROVAL.`);
      return { closedBatches: activeBatchesList.length };
    });
  }

  async logPackaging(batchId: string, operatorId: string, packType: string, quantity: number, unitsPerPack: number, remarks?: string) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (!['RUNNING', 'CHANGEOVER', 'QC_PENDING', 'COMPLETED'].includes(batch.status)) {
         throw new BadRequestException(`Cannot log packaging for batch in ${batch.status} state.`);
      }

      const res = await tx.insert(packagingLogs).values({
        batchId,
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
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).for('update');
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status !== 'COMPLETED' && batch.status !== 'QC_PENDING') {
         throw new BadRequestException('Batch must be at least QC_PENDING or COMPLETED to dispatch.');
      }

      const res = await tx.insert(dispatchLogs).values({
        batchId,
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

  async reopenBatch(batchId: string, userId: string, reason: string) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches)
        .where(eq(productionBatches.id, batchId))
        .for('update');
      
      if (!batch) throw new BadRequestException('Batch not found.');
      if (batch.status === 'RUNNING') throw new BadRequestException('Batch is already running.');

      const [updatedBatch] = await tx.update(productionBatches)
        .set({ 
          status: 'RUNNING',
          isLocked: false,
          updatedBy: userId,
          updatedAt: new Date(),
          remarks: sql`COALESCE(${productionBatches.remarks}, '') || '\n[REOPENED]: ' || ${reason}`
        })
        .where(eq(productionBatches.id, batchId))
        .returning();

      // Ensure line is set to RUNNING if not already
      await tx.update(productionLines)
        .set({ status: 'RUNNING' })
        .where(eq(productionLines.id, batch.lineId));

      return updatedBatch;
    });
  }

  async reassignOperators(batchId: string, userId: string, operatorIds: string[]) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
      if (!batch) throw new BadRequestException('Batch not found.');

      // 1. Deactivate current active sessions for this batch
      await tx.update(operatorSessions)
        .set({ isActive: false, endTime: new Date(), endedBy: userId, endReason: 'reassigned' })
        .where(and(eq(operatorSessions.batchId, batchId), eq(operatorSessions.isActive, true)));

      // 2. Insert new sessions
      if (operatorIds.length > 0) {
        const sessionValues = operatorIds.map(opId => ({
          userId: opId,
          lineId: batch.lineId,
          batchId,
          station: 'GENERAL',
          shiftId: batch.shiftId,
          isActive: true
        }));
        await tx.insert(operatorSessions).values(sessionValues);
      }

      return { success: true };
    });
  }

  async getLifecycleLogs(type?: 'qc' | 'packaging' | 'dispatch') {
    if (type === 'packaging') {
      return await db.select().from(packagingLogs)
        .orderBy(desc(packagingLogs.createdAt)).limit(50);
    } else {
      return await db.select().from(dispatchLogs)
        .orderBy(desc(dispatchLogs.dispatchedAt)).limit(50);
    }
  }
}
