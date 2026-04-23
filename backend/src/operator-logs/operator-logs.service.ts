import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { db } from '../db/db';
import { factoryLogs, batchTotals } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { CreateLogDto } from './dto/create-log.dto';
import { ProductionGateway } from '../events/production.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OperatorLogsService {
  private readonly logger = new Logger(OperatorLogsService.name);

  constructor(
    private readonly eventsGateway: ProductionGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createLog(userId: string, dto: CreateLogDto) {
    return await db.transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.select().from(factoryLogs)
        .where(eq(factoryLogs.requestId, dto.requestId))
        .limit(1);
      
      if (existing.length > 0) {
        this.logger.warn(`Duplicate request detected: ${dto.requestId}`);
        return existing[0];
      }

      // 2. Fetch Totals for Validation (Lock for update)
      const totalsList = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, dto.batchId))
        .for('update');

      
      if (totalsList.length === 0) {
        throw new BadRequestException('Batch tracking not initialized for this ID.');
      }
      
      const current = totalsList[0];

      // 3. Flow Validation (Blowing -> Filling -> Labeling -> Packing)
      await this.validateProductionFlow(dto.station, dto.primaryCount, current, dto.batchId);

      // 4. Insert Log
      const [log] = await tx.insert(factoryLogs).values({
        requestId: dto.requestId,
        batchId: dto.batchId,
        lineId: dto.lineId,
        shiftId: dto.shiftId,
        userId: userId,
        station: dto.station,
        primaryCount: dto.primaryCount,
        wastageCount: dto.wastageCount,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();


      // 5. Atomic Totals Update
      const updateField = this.getFieldName(dto.station);
      await tx.update(batchTotals)
        .set({ 
          [updateField]: sql`${batchTotals[updateField]} + ${dto.primaryCount}`,
          updatedAt: new Date()
        })
        .where(eq(batchTotals.batchId, dto.batchId));

      this.logger.log(`Log created: ${dto.station} (+${dto.primaryCount}) for batch ${dto.batchId}`);
      
      // Emit real-time event
      this.eventsGateway.emitProductionUpdated(dto.batchId);

      // Milestone trigger (every 5000 units packed)
      if (dto.station === 'PACKING') {
        const oldPacked = current.packingTotal;
        const newPacked = oldPacked + dto.primaryCount;
        const oldMilestone = Math.floor(oldPacked / 5000);
        const newMilestone = Math.floor(newPacked / 5000);

        if (newMilestone > oldMilestone && newMilestone > 0) {
          const milestoneAmount = newMilestone * 5000;
          this.notificationsService.triggerBatchMilestone(dto.batchId, milestoneAmount, 'Production Line').catch(e => 
            this.logger.error('Failed to trigger milestone alert: ' + e.message)
          );
        }
      }
      
      return log;
    });
  }

  private async validateProductionFlow(station: string, count: number, totals: any, batchId: string) {
    if (station === 'FILLING' && (totals.fillingTotal + count) > totals.blowingTotal) {
      await this.notificationsService.triggerFlowViolation(`Cannot fill ${count} units. Blowing output is only ${totals.blowingTotal}.`, batchId);
      throw new BadRequestException(`Flow Violation: Cannot fill ${count} units. Blowing output is only ${totals.blowingTotal}.`);
    }
    if (station === 'LABELING' && (totals.labelingTotal + count) > totals.fillingTotal) {
      await this.notificationsService.triggerFlowViolation(`Cannot label ${count} units. Filling output is only ${totals.fillingTotal}.`, batchId);
      throw new BadRequestException(`Flow Violation: Cannot label ${count} units. Filling output is only ${totals.fillingTotal}.`);
    }
    if (station === 'PACKING' && (totals.packingTotal + count) > totals.labelingTotal) {
      await this.notificationsService.triggerFlowViolation(`Cannot pack ${count} units. Labeling output is only ${totals.labelingTotal}.`, batchId);
      throw new BadRequestException(`Flow Violation: Cannot pack ${count} units. Labeling output is only ${totals.labelingTotal}.`);
    }
  }

  private getFieldName(station: string): any {
    const map: any = {
      BLOWING: 'blowingTotal',
      FILLING: 'fillingTotal',
      LABELING: 'labelingTotal',
      PACKING: 'packingTotal',
    };
    return map[station];
  }

  // Legacy support for older UI if needed (Internal)
  async logBlowing(dto: any) { return this.createLog(dto.userId, { ...dto, station: 'BLOWING' }); }
  async logFilling(dto: any) { return this.createLog(dto.userId, { ...dto, station: 'FILLING' }); }
  async logLabeling(dto: any) { return this.createLog(dto.userId, { ...dto, station: 'LABELING' }); }
  async logPacking(dto: any) { return this.createLog(dto.userId, { ...dto, station: 'PACKING' }); }
}
