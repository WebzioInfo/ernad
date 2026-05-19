import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { changeoverLogs, productionBatches, productionLines, factories, batchTotals, operatorSessions } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { BatchService } from './services/batch.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ChangeoverService {
  private readonly logger = new Logger(ChangeoverService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private batchService: BatchService,
    private audit: AuditService
  ) {}

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async initiateChangeover(batchId: string, toProductId: string, userId: string, extra?: { reason?: string, notes?: string, startTime?: string }) {
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
        startTime: extra?.startTime ? new Date(extra.startTime) : new Date(),
        leftoverMaterials: {},
        wastedMaterials: {},
        reason: extra?.reason || 'SKU_CHANGE',
        notes: extra?.notes || null,
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
      
      if (!log) {
        this.logger.error(`No active changeover log found for batch ${batchId}`);
        throw new BadRequestException('No active changeover found for this batch.');
      }

      // Mark changeover as completed
      await tx.update(changeoverLogs).set({ endTime: new Date() }).where(eq(changeoverLogs.id, log.id));

      // Close the previous batch
      await tx.update(productionBatches)
        .set({ status: 'CLOSED', endTime: new Date() })
        .where(eq(productionBatches.id, batchId));

      const [oldBatch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
      if (!oldBatch) {
        throw new BadRequestException('Source batch records corrupted or missing.');
      }

      if (!log.toProductId) {
        throw new BadRequestException('Target product for changeover was not specified.');
      }

      const batchCode = await this.batchService.generateBatchCode(tx);

      // Create the new batch (Transitioned from changeover)
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

      if (!newBatch) {
        throw new Error('Failed to create new batch record during transition.');
      }

      // Initialize totals for the new batch
      await tx.insert(batchTotals).values({
        batchId: newBatch.id,
        factoryId,
        lineId: log.lineId,
        blowingTotal: 0,
        fillingTotal: 0,
        labelingTotal: 0,
        packingTotal: 0,
        scrapTotal: 0,
        capTotal: 0,
        preformTotal: 0,
        bopRollTotal: '0',
        shrinkWeightTotal: '0',
        finishedGoodsTotal: 0,
        casesTotal: 0,
      });

      // Atomically carry over active operator sessions to the new batch context
      await tx.update(operatorSessions)
        .set({ batchId: newBatch.id })
        .where(and(
          eq(operatorSessions.lineId, log.lineId), 
          eq(operatorSessions.isActive, true)
        ));

      // Resume line operations
      await tx.update(productionLines)
        .set({ status: 'RUNNING' })
        .where(eq(productionLines.id, log.lineId));

      return newBatch;
    });

    await this.eventsService.emitLineStatus(result.lineId, 'RUNNING');
    await this.eventsService.emitProductionUpdated(result.id, result.lineId);
    return result;
  }

  async finishChangeover(batchId: string, leftoverMaterials: any, wastedMaterials: any) {
    this.logger.log(`Finishing changeover for batch ${batchId}`);
    await db.update(productionBatches).set({ status: 'RUNNING' }).where(eq(productionBatches.id, batchId));

    const endTime = new Date();
    const [log] = await db.update(changeoverLogs)
      .set({
        leftoverMaterials: leftoverMaterials,
        wastedMaterials: wastedMaterials,
        endTime: endTime
      })
      .where(eq(changeoverLogs.batchId, batchId))
      .returning();

    const durationMinutes = log && log.startTime 
      ? Math.round((endTime.getTime() - new Date(log.startTime).getTime()) / 60000)
      : 0;

    return { 
      success: true, 
      message: 'Changeover finished successfully.',
      durationMinutes
    };
  }

  async updateChangeover(logId: string, userId: string, data: { startTime?: Date, endTime?: Date, reason?: string, notes?: string }, auditReason: string) {
    return await db.transaction(async (tx) => {
      const [oldLog] = await tx.select().from(changeoverLogs).where(eq(changeoverLogs.id, logId)).limit(1);
      if (!oldLog) throw new BadRequestException('Changeover log not found');

      const [updated] = await tx.update(changeoverLogs)
        .set({
          ...data,
          // If we update times, we might need to recalculate durations in analytics
        })
        .where(eq(changeoverLogs.id, logId))
        .returning();

      await this.audit.logCorrection(
        userId,
        'changeover_logs',
        logId,
        oldLog,
        updated,
        auditReason
      );

      return updated;
    });
  }
}
