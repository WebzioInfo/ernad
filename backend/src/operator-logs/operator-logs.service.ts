import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { db } from '../db/db';
import { factoryLogs, batchTotals, materialsUsage } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { CreateLogDto } from './dto/create-log.dto';
import { ProductionGateway } from '../events/production.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ShiftService } from '../master-data/shift.service';

@Injectable()
export class OperatorLogsService {
  private readonly logger = new Logger(OperatorLogsService.name);

  constructor(
    private readonly eventsGateway: ProductionGateway,
    private readonly notificationsService: NotificationsService,
    private readonly shiftService: ShiftService,
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

      // 2. Fetch Totals for Validation
      const totalsList = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, dto.batchId))
        .for('update');
      
      if (totalsList.length === 0) {
        throw new BadRequestException('Batch tracking not initialized.');
      }
      
      const current = totalsList[0];

      // 3. Shift Validation
      const isValidShift = await this.shiftService.validateShiftEntry(dto.shiftId, dto.loggedAt ? new Date(dto.loggedAt) : new Date());
      if (!isValidShift) {
        throw new BadRequestException('Inactive or expired shift.');
      }

      // 4. Data Processing (Phase 4): Handle Split Values
      let finalPrimaryCount = dto.primaryCount;
      if (dto.splitValues && dto.splitValues.length > 0) {
        finalPrimaryCount = dto.splitValues.reduce((sum, val) => sum + val, 0);
      }

      // 5. Flow Validation (Phase 1)
      // FIX: Skip flow validation for REWORK entries (Phase 6 Fix)
      if (!dto.isRework) {
        await this.validateProductionFlow(dto.station, finalPrimaryCount, current, dto.batchId);
      }

      // 6. Insert Main Log
      const [log] = await tx.insert(factoryLogs).values({
        requestId: dto.requestId,
        batchId: dto.batchId,
        lineId: dto.lineId,
        shiftId: dto.shiftId,
        brandId: dto.brandId,
        productId: dto.productId,
        userId: userId,
        station: dto.station,
        primaryCount: finalPrimaryCount,
        splitValues: dto.splitValues || [],
        wastageCount: dto.wastageCount,
        isRework: dto.isRework || false,
        eventType: dto.eventType || 'NORMAL_PRODUCTION',
        remarks: dto.remarks,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();

      // 7. Material Tracking Module (Phase 2)
      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await tx.insert(materialsUsage).values({
            logId: log.id,
            batchId: dto.batchId,
            materialName: mat.materialName,
            quantity: String(mat.quantity),
            unit: mat.unit,
            waste: mat.waste ? String(mat.waste) : '0',
            loggedAt: log.loggedAt
          });
        }
      }

      // 8. Atomic Totals Update
      // FIX: Only increment totals if NOT rework (rework is counted separately in analytics)
      if (!dto.isRework) {
        const updateField = this.getFieldName(dto.station);
        await tx.update(batchTotals)
          .set({ 
            [updateField]: sql`${batchTotals[updateField]} + ${finalPrimaryCount}`,
            updatedAt: new Date()
          })
          .where(eq(batchTotals.batchId, dto.batchId));
      }

      // 9. Notifications (Phase 7)
      if (dto.eventType && dto.eventType !== 'NORMAL_PRODUCTION') {
        await this.notificationsService.createNotification(
          'MACHINE_ISSUE', 
          `Issue on Station: ${dto.station}`, 
          `${dto.eventType}: ${dto.remarks || 'No remarks provided'}`, 
          'CRITICAL'
        );
      }

      // 10. Real-time Gateway (Phase 7)
      this.eventsGateway.emitNewLog(log);
      this.eventsGateway.emitProductionUpdated(dto.batchId, dto.lineId);
      
      return log;
    });
  }

  private async validateProductionFlow(station: string, count: number, totals: any, batchId: string) {
    const nextTotal = (totals[this.getFieldName(station)] || 0) + count;
    
    if (station === 'FILLING' && nextTotal > totals.blowingTotal) {
      throw new BadRequestException(`Flow Violation: Filling (${nextTotal}) > Blowing (${totals.blowingTotal}).`);
    }
    if (station === 'LABELING' && nextTotal > totals.fillingTotal) {
      throw new BadRequestException(`Flow Violation: Labeling (${nextTotal}) > Filling (${totals.fillingTotal}).`);
    }
    if (station === 'PACKING' && nextTotal > totals.labelingTotal) {
      throw new BadRequestException(`Flow Violation: Packing (${nextTotal}) > Labeling (${totals.labelingTotal}).`);
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
}
