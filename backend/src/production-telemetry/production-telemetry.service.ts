import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { db } from '../db/db';
import { users, productionLogs, batchTotals, materialsUsage, rawMaterials, stockTransactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { ProductionTelemetryDto } from './dto/production-telemetry.dto';
import { ProductionEventsService } from '../events/production.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ShiftService } from '../factory-config/shift.service';
import { RedisService } from '../common/redis/redis.service';
import { OperatorSessionService } from '../operator-session/operator-session.service';

@Injectable()
export class ProductionTelemetryService {
  private readonly logger = new Logger(ProductionTelemetryService.name);

  constructor(
    @Optional() @InjectQueue('telemetry') private readonly telemetryQueue: Queue | null,
    private readonly eventsService: ProductionEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly shiftService: ShiftService,
    private readonly redisService: RedisService,
    private readonly sessionService: OperatorSessionService,
  ) {}

  async createLog(userId: string, dto: ProductionTelemetryDto) {
    if (!dto.batchId || !dto.station || !dto.sessionId) {
      throw new BadRequestException('Invalid telemetry payload. Session ID and Station are required.');
    }

    // 1. Validate Session
    const session = await this.sessionService.getCurrentSession(userId);
    if (!session || session.id !== dto.sessionId) {
      throw new BadRequestException('No active session found for this operator or Session ID mismatch.');
    }

    if (session.station !== dto.station) {
      throw new BadRequestException(`Operator assigned to ${session.station} but logging for ${dto.station}.`);
    }

    if (session.lineId !== dto.lineId) {
      throw new BadRequestException('Operator is assigned to a different production line.');
    }

    if (session.batchId && session.batchId !== dto.batchId) {
      throw new BadRequestException('Batch mismatch. Please end session and restart for the new batch.');
    }

    // ── Vercel/Serverless Constraint: Workers don't run in serverless functions ──
    const isServerless = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

    // ── Graceful Degradation: If Redis is down, queue is absent, or serverless mode ──
    if (!this.telemetryQueue || !this.redisService.getAvailability() || isServerless) {
      if (isServerless) {
        this.logger.log('Vercel/Serverless detected: Processing telemetry log synchronously (Skip Queue)');
      } else {
        this.logger.warn('Redis offline or queue unavailable: Processing telemetry log synchronously (Direct-to-DB)');
      }
      await this.handleTelemetryLog(userId, dto);
      return {
        status: 'ACCEPTED',
        requestId: dto.requestId,
        message: 'Processed synchronously due to Redis unavailability.'
      };
    }

    try {
      const job = await this.telemetryQueue.add('log-ingestion', {
        userId,
        dto
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        jobId: dto.requestId
      });

      this.logger.log(`Telemetry job ${job.id} queued for processing.`);

      return { 
        status: 'ACCEPTED', 
        jobId: job.id, 
        requestId: dto.requestId,
        message: 'Log queued for persistent processing.'
      };
    } catch (err) {
      this.logger.error(`Failed to queue job: ${err.message}. Falling back to sync.`);
      await this.handleTelemetryLog(userId, dto);
      return { status: 'ACCEPTED', requestId: dto.requestId, message: 'Processed synchronously (Queue Error)' };
    }
  }

  async handleTelemetryLog(userId: string, dto: ProductionTelemetryDto) {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(productionLogs)
        .where(eq(productionLogs.requestId, dto.requestId))
        .limit(1);
      
      if (existing.length > 0) {
        this.logger.warn(`Duplicate request detected in DB: ${dto.requestId}`);
        return existing[0];
      }

      // Fetch user's factoryId
      const [user] = await tx.select({ factoryId: users.factoryId }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !user.factoryId) {
        throw new BadRequestException('User not assigned to a factory.');
      }
      const factoryId = user.factoryId;

      const totalsList = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, dto.batchId))
        .for('update');
      
      if (totalsList.length === 0) {
        throw new BadRequestException('Batch tracking not initialized.');
      }
      
      const current = totalsList[0];

      const isValidShift = await this.shiftService.validateShiftEntry(dto.shiftId, dto.loggedAt ? new Date(dto.loggedAt) : new Date());
      if (!isValidShift) {
        throw new BadRequestException('Inactive or expired shift.');
      }

      let finalPrimaryCount = dto.primaryCount;
      if (dto.splitValues && dto.splitValues.length > 0) {
        finalPrimaryCount = dto.splitValues.reduce((sum, val) => sum + val, 0);
      }

      if (!dto.isRework) {
        await this.validateProductionFlow(dto.station, finalPrimaryCount, current, dto.batchId);
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
        // ── AUTO-DEDUCTION ENGINE (Domain Rule: MES v3.0) ──
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
        await this.redisService.incrementCounter(dto.batchId, dto.station, finalPrimaryCount);
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
      
      // Update session activity
      await this.sessionService.heartbeat(userId);
      
      return log;
    });
  }

  private async processMaterialUsage(tx: any, logId: number, batchId: string, factoryId: string, mat: any, loggedAt: Date) {
    // 1. Insert into materials_usage (Audit log for the batch)
    await tx.insert(materialsUsage).values({
      logId,
      batchId,
      materialName: mat.materialName,
      quantity: String(mat.quantity),
      unit: mat.unit,
      waste: mat.waste ? String(mat.waste) : '0',
      loggedAt
    });

    // 2. Find material in master data to update global stock
    const [material] = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, mat.materialName));
    
    if (material) {
      // 3. Deduct from global stock
      await tx.update(rawMaterials)
        .set({ 
          currentStock: sql`${rawMaterials.currentStock} - ${mat.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(rawMaterials.id, material.id));

      // 4. Create stock transaction record (Financial/Logistics Audit)
      await tx.insert(stockTransactions).values({
        materialId: material.id,
        factoryId,
        type: 'OUT',
        quantity: String(mat.quantity),
        referenceId: batchId,
        remarks: `Auto-deduction from Production Log #${logId}`,
        createdAt: new Date()
      });

      // 5. Check for low stock alerts
      const newStock = Number(material.currentStock) - Number(mat.quantity);
      if (newStock <= Number(material.minimumStock)) {
        await this.notificationsService.createNotification(
          'LOW_STOCK',
          `Low Stock Alert: ${material.name}`,
          `Inventory for ${material.name} has dropped below minimum threshold (${material.minimumStock} ${material.unit}). Current: ${newStock}`,
          'WARNING'
        );
      }
    } else {
      this.logger.warn(`Material [${mat.materialName}] not found in master data. Stock deduction skipped.`);
    }
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
