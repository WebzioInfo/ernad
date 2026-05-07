import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { users, productionLogs, batchTotals, materialsUsage, rawMaterials, stockTransactions } from '../../../database/schema';
import { eq, sql } from 'drizzle-orm';
import { ProductionTelemetryDto } from '../dto/production-telemetry.dto';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShiftService } from '../../factory-config/shift.service';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionService } from '../../operator-session/operator-session.service';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly eventsService: ProductionEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly shiftService: ShiftService,
    private readonly redisService: RedisService,
    private readonly sessionService: OperatorSessionService,
  ) {}

  async handleTelemetryLog(userId: string, dto: ProductionTelemetryDto) {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(productionLogs)
        .where(eq(productionLogs.requestId, dto.requestId))
        .limit(1);
      
      if (existing.length > 0) {
        this.logger.warn(`Duplicate request detected in DB: ${dto.requestId}`);
        return existing[0];
      }

      // 2. Recovery: Get Factory Context from Batch/Session
      const totalsList = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, dto.batchId))
        .for('update');
      
      if (totalsList.length === 0) {
        throw new BadRequestException('Batch tracking not initialized.');
      }
      
      const current = totalsList[0];
      const factoryId = current.factoryId; // Get factory context from the batch itself

      const isValidShift = await this.shiftService.validateShiftEntry(dto.shiftId, dto.loggedAt ? new Date(dto.loggedAt) : new Date());
      if (!isValidShift) {
        throw new BadRequestException('Inactive or expired shift.');
      }

      let finalPrimaryCount = dto.primaryCount;
      if (dto.splitValues && dto.splitValues.length > 0) {
        finalPrimaryCount = dto.splitValues.reduce((sum, val) => sum + val, 0);
      }

      if (!dto.isRework) {
        await this.validateProductionFlow(dto.station, finalPrimaryCount, current);
      }

      const [log] = await tx.insert(productionLogs).values({
        requestId: dto.requestId,
        batchId: dto.batchId,
        lineId: dto.lineId,
        shiftId: dto.shiftId,
        brandId: dto.brandId,
        productId: dto.productId,
        factoryId: factoryId,
        userId: userId,
        sessionId: dto.sessionId,
        station: dto.station,
        primaryCount: finalPrimaryCount,
        splitValues: dto.splitValues || [],
        wastageCount: dto.wastageCount,
        isRework: dto.isRework || false,
        eventType: dto.eventType || 'NORMAL_PRODUCTION',
        remarks: dto.remarks,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();

      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await this.processMaterialUsage(tx, log.id, dto.batchId, factoryId, mat, log.loggedAt);
        }
      } else if (!dto.isRework) {
        const autoMap: Record<string, string> = {
          BLOWING: 'Preforms',
          FILLING: 'Caps',
          LABELING: 'Labels',
          PACKING: 'Shrink Roll'
        };

        const materialName = autoMap[dto.station];
        if (materialName) {
          await this.processMaterialUsage(tx, log.id, dto.batchId, factoryId, {
            materialName,
            quantity: finalPrimaryCount,
            unit: 'Pcs'
          }, log.loggedAt);
        }
      }

      if (!dto.isRework) {
        const updateField = this.getFieldName(dto.station);
        
        // Fast-fail Redis increment
        if (this.redisService.getAvailability()) {
          this.redisService.incrementCounter(dto.batchId, dto.station, finalPrimaryCount).catch(() => {});
        }

        await tx.update(batchTotals)
          .set({ 
            [updateField]: sql`${batchTotals[updateField]} + ${finalPrimaryCount}`,
            updatedAt: new Date()
          })
          .where(eq(batchTotals.batchId, dto.batchId));
      }

      if (dto.eventType && dto.eventType !== 'NORMAL_PRODUCTION') {
        await this.notificationsService.createNotification(
          'MACHINE_ISSUE', 
          `Issue on Station: ${dto.station}`, 
          `${dto.eventType}: ${dto.remarks || 'No remarks provided'}`, 
          'CRITICAL'
        );
      }

      this.eventsService.emitNewLog(log);
      this.eventsService.emitProductionUpdated(dto.batchId, dto.lineId);
      
      await this.sessionService.heartbeat(userId);
      
      return log;
    });
  }

  private async processMaterialUsage(tx: any, logId: number, batchId: string, factoryId: string, mat: any, loggedAt: Date) {
    await tx.insert(materialsUsage).values({
      logId,
      batchId,
      materialName: mat.materialName,
      quantity: String(mat.quantity),
      unit: mat.unit,
      waste: mat.waste ? String(mat.waste) : '0',
      loggedAt
    });

    const [material] = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, mat.materialName));
    
    if (material) {
      await tx.update(rawMaterials)
        .set({ 
          currentStock: sql`${rawMaterials.currentStock} - ${mat.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(rawMaterials.id, material.id));

      await tx.insert(stockTransactions).values({
        materialId: material.id,
        factoryId,
        type: 'OUT',
        quantity: String(mat.quantity),
        referenceId: batchId,
        remarks: `Auto-deduction from Production Log #${logId}`,
        createdAt: new Date()
      });

      const newStock = Number(material.currentStock) - Number(mat.quantity);
      if (newStock <= Number(material.minimumStock)) {
        await this.notificationsService.createNotification(
          'LOW_STOCK',
          `Low Stock Alert: ${material.name}`,
          `Inventory for ${material.name} has dropped below minimum threshold (${material.minimumStock} ${material.unit}). Current: ${newStock}`,
          'WARNING'
        );
      }
    }
  }

  private async validateProductionFlow(station: string, count: number, totals: any) {
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

  async getLogHistory(batchId: string, station: string, limit = 20) {
    return await db.select()
      .from(productionLogs)
      .where(
        sql`${productionLogs.batchId} = ${batchId} AND ${productionLogs.station} = ${station}`
      )
      .orderBy(sql`${productionLogs.loggedAt} DESC`)
      .limit(limit);
  }
}
