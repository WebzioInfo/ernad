import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { db } from '../../../database/db';
import { eq, sql, and, isNull, desc, gte, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  productionLogs,
  batchTotals,
  materialsUsage,
  inventoryStock,
  inventoryTransactions,
  productionBatches,
  downtimeLogs,
  users
} from '../../../database/schema';
import { billOfMaterials } from '../../../database/schema';
import { TelemetryDto } from '../dto/telemetry.dto';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShiftService } from '../../master-data/shift.service';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly eventsService: ProductionEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly shiftService: ShiftService,
    private readonly redisService: RedisService,
    private readonly sessionService: OperatorSessionsService,
    private readonly auditService: AuditService,
  ) { }


  async handleTelemetryLog(userId: string, dto: TelemetryDto) {
    return await db.transaction(async (tx) => {
      this.logger.debug(`[PROCESSOR] Verifying idempotency for requestId: ${dto.requestId}`);

      const existing = await tx.select().from(productionLogs)
        .where(eq(productionLogs.requestId, dto.requestId))
        .limit(1)
        .catch(err => {
          this.logger.error(`[PROCESSOR] Query failed for requestId ${dto.requestId}: ${err.message}`);
          throw err;
        });

      if (existing.length > 0) {
        this.logger.warn(`Duplicate request detected in DB: ${dto.requestId}`);
        return existing[0];
      }

      // 2. Recovery: Get Factory Context from Batch/Session
      const totalsList = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, dto.batchId))
        .for('update');

      if (totalsList.length === 0) {
        this.logger.error(`[PROCESSOR] Batch totals missing for batchId: ${dto.batchId}`);
        throw new BadRequestException('Batch tracking not initialized.');
      }

      const current = totalsList[0];
      const factoryId = current.factoryId;

      // 3. Batch Integrity Validation
      await this.validateBatchStatus(tx, dto.batchId);

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
        eventType: (dto.eventType || 'NORMAL_PRODUCTION') as any,
        remarks: dto.remarks,
        capUsage: dto.capUsage || 0,
        capRejection: dto.capRejection || 0,
        preformUsage: dto.preformUsage || 0,
        preformRejection: dto.preformRejection || 0,
        bopRollUsage: String(dto.bopRollUsage || 0),
        bopRejection: String(dto.bopRejection || 0),
        shrinkWeightUsed: String(dto.shrinkWeightUsed || 0),
        shrinkWeightRejected: String(dto.shrinkWeightRejected || 0),
        inkUsage: String(dto.inkUsage || 0),
        solventUsage: String(dto.solventUsage || 0),
        labelUsage: dto.bopRollUsage || 0,
        casesProduced: dto.casesProduced || 0,
        packingTypeId: dto.packingTypeId,
        finishedGoodsProduced: dto.finishedGoodsProduced || 0,
        materialCost: String(dto.materialCost || 0),
        boxCount: dto.boxCount || 0,
        secondaryPackagingCount: dto.secondaryPackagingCount || 0,
        // QC Data
        phValue: String(dto.phValue || '0'),
        tdsValue: String(dto.tdsValue || '0'),
        testResult: dto.testResult as any,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();

      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await this.processLegacyMaterialUsage(tx, log.id, dto.batchId, factoryId, mat, log.loggedAt);
        }
      }

      // New Enterprise Material Logic
      await this.processEnterpriseInventory(tx, factoryId, dto, log.id);

      if (!dto.isRework && dto.station !== 'QC') {
        const updateField = this.getFieldName(dto.station);

        // Fast-fail Redis increment
        if (this.redisService.getAvailability()) {
          this.redisService.incrementCounter(dto.batchId, dto.station, finalPrimaryCount).catch(() => { });
        }

        await tx.update(batchTotals)
          .set({
            [updateField]: sql`${batchTotals[updateField]} + ${finalPrimaryCount}`,
            scrapTotal: sql`${batchTotals.scrapTotal} + ${dto.wastageCount}`,

            // Enterprise Material Totals
            capTotal: sql`${batchTotals.capTotal} + ${dto.capUsage || 0}`,
            preformTotal: sql`${batchTotals.preformTotal} + ${dto.preformUsage || 0}`,
            bopRollTotal: sql`${batchTotals.bopRollTotal} + ${dto.bopRollUsage || 0}`,
            shrinkWeightTotal: sql`${batchTotals.shrinkWeightTotal} + ${dto.shrinkWeightUsed || 0}`,
            inkTotal: sql`${batchTotals.inkTotal} + ${dto.inkUsage || 0}`,
            solventTotal: sql`${batchTotals.solventTotal} + ${dto.solventUsage || 0}`,
            finishedGoodsTotal: sql`${batchTotals.finishedGoodsTotal} + ${dto.finishedGoodsProduced || 0}`,
            casesTotal: sql`${batchTotals.casesTotal} + ${dto.casesProduced || 0}`,

            updatedAt: new Date()
          })
          .where(eq(batchTotals.batchId, dto.batchId));
      }
      // ── NEW: Downtime & Production Time Tracking ──
      await this.handleDowntime(tx, factoryId, dto);

      this.eventsService.emitNewLog(log);
      this.eventsService.emitProductionUpdated(dto.batchId, dto.lineId);

      await this.sessionService.heartbeat(userId);

      return log;
    });
  }

  private async processLegacyMaterialUsage(tx: any, logId: number, batchId: string, factoryId: string, mat: any, loggedAt: Date) {
    await tx.insert(materialsUsage).values({
      logId,
      batchId,
      materialName: mat.materialName,
      quantity: String(mat.quantity),
      unit: mat.unit,
      waste: mat.waste ? String(mat.waste) : '0',
      loggedAt
    });
  }

  private async processEnterpriseInventory(tx: any, factoryId: string, dto: TelemetryDto, logId: number) {
    const consumptionMap: Array<{ name: string; qty: number; category: string }> = [];

    if (dto.capUsage) consumptionMap.push({ name: 'Caps', qty: Number(dto.capUsage) + Number(dto.capRejection || 0), category: 'Caps' });
    if (dto.preformUsage) consumptionMap.push({ name: 'Preforms', qty: Number(dto.preformUsage) + Number(dto.preformRejection || 0), category: 'Preforms' });
    if (dto.bopRollUsage) consumptionMap.push({ name: 'Labels', qty: Number(dto.bopRollUsage) + Number(dto.bopRejection || 0), category: 'Labels' });
    if (dto.shrinkWeightUsed) consumptionMap.push({ name: 'Shrink Film', qty: Number(dto.shrinkWeightUsed) + Number(dto.shrinkWeightRejected || 0), category: 'Shrink Rolls' });
    if (dto.inkUsage) consumptionMap.push({ name: 'Ink', qty: Number(dto.inkUsage), category: 'Chemicals' });
    if (dto.solventUsage) consumptionMap.push({ name: 'Solvent', qty: Number(dto.solventUsage), category: 'Chemicals' });

    // ── NEW: Automated BOM Consumption ──
    // If this is a final station log, trigger BOM-based deduction
    if (dto.station === 'PACKING' && dto.productId) {
      const bomItems = await tx.select().from(billOfMaterials).where(eq(billOfMaterials.productId, dto.productId));
      for (const bom of bomItems) {
        const qty = Number(bom.quantityPerUnit) * dto.primaryCount;

        // Find existing or add new
        const existingIdx = consumptionMap.findIndex(c => c.name === bom.stockId); // Using stockId as key for internal loop
        if (existingIdx > -1) {
          consumptionMap[existingIdx].qty += qty;
        } else {
          consumptionMap.push({
            name: bom.stockId, // We'll handle stock lookup by ID now
            qty: qty,
            category: 'BOM_AUTO'
          });
        }
      }
    }

    for (const item of consumptionMap) {
      if (item.qty <= 0) continue;

      let stock;

      // Mandatory Stock Selection for Production Stability
      if (item.category === 'BOM_AUTO') {
        const results = await tx.select().from(inventoryStock)
          .where(eq(inventoryStock.id, item.name))
          .for('update');
        stock = results[0];
      } else if (dto.selectedStockId) {
        const results = await tx.select().from(inventoryStock)
          .where(eq(inventoryStock.id, dto.selectedStockId))
          .for('update');
        stock = results[0];
      }

      if (!stock && item.category !== 'BOM_AUTO') {
        const stockItems = await tx.select()
          .from(inventoryStock)
          .where(and(
            eq(inventoryStock.factoryId, factoryId),
            eq(inventoryStock.itemName, item.name)
          ))
          .for('update');
        stock = stockItems[0];
      }

      if (!stock) {
        throw new BadRequestException(`Material stock not found for ${item.name}. Please assign stock in the Operator Panel.`);
      }

      const currentQty = Number(stock.quantity);
      if (currentQty < item.qty) {
        throw new BadRequestException(`INSUFFICIENT_STOCK: Required ${item.qty} ${stock.unit} of ${stock.itemName}, but only ${currentQty} available.`);
      }

      const newQty = currentQty - item.qty;

      await tx.update(inventoryStock)
        .set({
          quantity: String(newQty),
          updatedAt: new Date()
        })
        .where(eq(inventoryStock.id, stock.id));

      await tx.insert(inventoryTransactions).values({
        stockId: stock.id,
        type: 'CONSUMPTION',
        quantityChange: String(-item.qty),
        balanceAfter: String(newQty),
        referenceId: String(logId),
        remarks: `Production Log #${logId} (${dto.station})`,
        createdAt: new Date()
      });

      if (newQty <= Number(stock.minimumStock)) {
        await this.notificationsService.createNotification(
          'LOW_STOCK',
          `Enterprise Stock Alert: ${stock.itemName}`,
          `Current: ${newQty} ${stock.unit} | Min: ${stock.minimumStock}`,
          'WARNING'
        );
      }
    }
  }

  private async validateProductionFlow(station: string, count: number, totals: any) {
    const nextTotal = (totals[this.getFieldName(station)] || 0) + count;

    if (station === 'FILLING' && nextTotal > totals.blowingTotal) {
      throw new BadRequestException(
        `FLOW_VIOLATION: Filling count (${nextTotal}) cannot exceed Blowing output (${totals.blowingTotal}). ` +
        `Shortfall: ${nextTotal - totals.blowingTotal} units.`
      );
    }
    if (station === 'LABELING' && nextTotal > totals.fillingTotal) {
      throw new BadRequestException(
        `FLOW_VIOLATION: Labeling count (${nextTotal}) cannot exceed Filling output (${totals.fillingTotal}). ` +
        `Shortfall: ${nextTotal - totals.fillingTotal} units.`
      );
    }
    if (station === 'PACKING' && nextTotal > totals.labelingTotal) {
      throw new BadRequestException(
        `FLOW_VIOLATION: Packing count (${nextTotal}) cannot exceed Labeling output (${totals.labelingTotal}). ` +
        `Shortfall: ${nextTotal - totals.labelingTotal} units.`
      );
    }

    // No flow validation for QC as it is not a sequential production unit in the same ledger
  }

  private async validateBatchStatus(tx: any, batchId: string) {
    const batch = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    if (batch.length === 0) throw new BadRequestException('Batch not found.');
    if (batch[0].status !== 'RUNNING' && batch[0].status !== 'CHANGEOVER') {
      throw new BadRequestException(`CANNOT_LOG: Batch is currently in ${batch[0].status} state.`);
    }
  }

  private async handleDowntime(tx: any, factoryId: string, dto: TelemetryDto) {
    const station = dto.station;
    const batchId = dto.batchId;
    const lineId = dto.lineId;
    const eventType = dto.eventType || 'NORMAL_PRODUCTION';
    const loggedAt = dto.loggedAt ? new Date(dto.loggedAt) : new Date();

    if (eventType !== 'NORMAL_PRODUCTION') {
      // 1. Check if there is an ongoing downtime for this station/batch with the SAME reason
      const ongoing = await tx.select().from(downtimeLogs)
        .where(and(
          eq(downtimeLogs.batchId, batchId),
          eq(downtimeLogs.station, station),
          eq(downtimeLogs.reason, eventType),
          isNull(downtimeLogs.endTime)
        ))
        .limit(1);

      if (ongoing.length === 0) {
        // Start new downtime log
        await tx.insert(downtimeLogs).values({
          batchId,
          lineId,
          factoryId,
          station,
          reason: eventType,
          startTime: loggedAt,
          remarks: dto.remarks
        });

        // Trigger notification for serious issues
        if (['POWER_FAILURE', 'MACHINE_BREAKDOWN'].includes(eventType)) {
          await this.notificationsService.createNotification(
            'MACHINE_ISSUE',
            `CRITICAL STOP: ${station} Line ${lineId}`,
            `Production halted due to ${eventType}. Reason: ${dto.remarks || 'No details provided'}`,
            'CRITICAL'
          );
        }
      }
    } else {
      // 2. If NORMAL_PRODUCTION, end ANY ongoing downtime for this station/batch
      const ongoingLogs = await tx.select().from(downtimeLogs)
        .where(and(
          eq(downtimeLogs.batchId, batchId),
          eq(downtimeLogs.station, station),
          isNull(downtimeLogs.endTime)
        ));

      for (const log of ongoingLogs) {
        const durationMs = loggedAt.getTime() - new Date(log.startTime).getTime();
        const durationMins = Math.max(1, Math.round(durationMs / 60000));

        await tx.update(downtimeLogs)
          .set({
            endTime: loggedAt,
            durationMinutes: durationMins,
            updatedAt: new Date()
          })
          .where(eq(downtimeLogs.id, log.id));
      }
    }
  }

  private getFieldName(station: string): any {
    const map: any = {
      BLOWING: 'blowingTotal',
      FILLING: 'fillingTotal',
      LABELING: 'labelingTotal',
      PACKING: 'packingTotal',
      QC: 'scrapTotal' // Sink QC errors into scrap for now or ignore
    };
    return map[station] || 'scrapTotal';
  }

  async getLogHistory(batchId: string, station: string, limit = 50) {
    const updatedByUsers = alias(users, 'updatedByUsers');

    return await db.select({
      id: productionLogs.id,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      eventType: productionLogs.eventType,
      secondaryPackagingCount: productionLogs.secondaryPackagingCount,
      remarks: productionLogs.remarks,
      loggedAt: productionLogs.loggedAt,
      userName: users.name,
      updatedByName: updatedByUsers.name,
      updatedAt: productionLogs.updatedAt,
    })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(updatedByUsers, eq(productionLogs.updatedBy, updatedByUsers.id))
      .where(
        and(
          eq(productionLogs.batchId, batchId),
          eq(productionLogs.station, station as any),
          isNull(productionLogs.deletedAt)
        )
      )
      .orderBy(desc(productionLogs.loggedAt))
      .limit(limit);
  }

  async updateLog(logId: number, userId: string, dto: { primaryCount?: number; wastageCount?: number; remarks?: string }) {
    const [existing] = await db.select().from(productionLogs).where(eq(productionLogs.id, logId)).limit(1);
    if (!existing) throw new BadRequestException('Production log not found.');

    // Validate Batch Status (Don't allow editing completed/closed batches)
    await this.validateBatchStatus(db, existing.batchId);

    const [updated] = await db.update(productionLogs)
      .set({
        ...(dto.primaryCount !== undefined && { primaryCount: dto.primaryCount }),
        ...(dto.wastageCount !== undefined && { wastageCount: dto.wastageCount }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        updatedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(productionLogs.id, logId))
      .returning();

    // Calculate deltas to apply atomically
    const primaryDelta = (dto.primaryCount !== undefined ? dto.primaryCount : existing.primaryCount) - existing.primaryCount;
    const wastageDelta = (dto.wastageCount !== undefined ? dto.wastageCount : existing.wastageCount) - existing.wastageCount;

    if (primaryDelta !== 0 || wastageDelta !== 0) {
      const updateField = this.getFieldName(existing.station);
      await db.update(batchTotals)
        .set({
          [updateField]: sql`${batchTotals[updateField]} + ${primaryDelta}`,
          scrapTotal: sql`${batchTotals.scrapTotal} + ${wastageDelta}`,
          updatedAt: new Date()
        })
        .where(eq(batchTotals.batchId, existing.batchId));
    }

    await this.auditService.logCorrection(
      userId,
      'production_logs',
      String(logId),
      existing,
      updated,
      dto.remarks || 'Manual Correction'
    );

    return updated;
  }

  async getAllLogs(filters: {
    lineId?: string;
    station?: string;
    userId?: string;
    batchId?: string;
    shiftId?: string;
    startDate?: string;
    endDate?: string;
    eventType?: string;
    isDeleted?: boolean;
  }, limit = 100) {
    const conditions = [];

    if (filters.lineId) conditions.push(eq(productionLogs.lineId, filters.lineId));
    if (filters.station) conditions.push(eq(productionLogs.station, filters.station as any));
    if (filters.userId) conditions.push(eq(productionLogs.userId, filters.userId));
    if (filters.batchId) conditions.push(eq(productionLogs.batchId, filters.batchId));
    if (filters.shiftId) conditions.push(eq(productionLogs.shiftId, filters.shiftId));
    if (filters.startDate) conditions.push(gte(productionLogs.loggedAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(productionLogs.loggedAt, new Date(filters.endDate)));
    if (filters.eventType) conditions.push(eq(productionLogs.eventType, filters.eventType as any));

    if (filters.isDeleted === true) {
      conditions.push(sql`${productionLogs.deletedAt} IS NOT NULL`);
    } else {
      conditions.push(isNull(productionLogs.deletedAt));
    }

    return await db.select({
      id: productionLogs.id,
      batchId: productionLogs.batchId,
      lineId: productionLogs.lineId,
      station: productionLogs.station,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      eventType: productionLogs.eventType,
      remarks: productionLogs.remarks,
      loggedAt: productionLogs.loggedAt,
      userName: users.name,
      updatedAt: productionLogs.updatedAt,
      deletedAt: productionLogs.deletedAt
    })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(productionLogs.loggedAt))
      .limit(limit);
  }

  async voidLog(logId: number, userId: string, reason: string) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).for('update');
      if (!existing) throw new BadRequestException('Log not found.');
      if (existing.deletedAt) throw new BadRequestException('Log already voided.');

      // 1. Soft delete the log
      const [voided] = await tx.update(productionLogs)
        .set({
          deletedAt: new Date(),
          deletedBy: userId,
          deletedReason: reason
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      // 2. Reconcile Totals (Subtract counts)
      const updateField = this.getFieldName(existing.station);
      await tx.update(batchTotals)
        .set({
          [updateField]: sql`${batchTotals[updateField]} - ${existing.primaryCount}`,
          scrapTotal: sql`${batchTotals.scrapTotal} - ${existing.wastageCount}`,
          updatedAt: new Date()
        })
        .where(eq(batchTotals.batchId, existing.batchId));

      // 3. Audit Log
      await this.auditService.logCorrection(
        userId,
        'production_logs',
        String(logId),
        existing,
        { ...existing, deletedAt: voided.deletedAt },
        `VOID: ${reason}`
      );

      return voided;
    });
  }

  async createManualLog(userId: string, dto: TelemetryDto) {
    const [batch] = await db.select().from(productionBatches).where(eq(productionBatches.id, dto.batchId)).limit(1);
    if (!batch) throw new BadRequestException('Target batch not found.');
    return await this.handleTelemetryLog(userId, dto);
  }

  async getActiveEvents(batchId: string) {
    return await db.select()
      .from(downtimeLogs)
      .where(and(
        eq(downtimeLogs.batchId, batchId),
        isNull(downtimeLogs.endTime)
      ))
      .orderBy(desc(downtimeLogs.startTime));
  }
}
