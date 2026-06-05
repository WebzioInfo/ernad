import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NonRetryableBusinessError } from '../../../common/errors/non-retryable-business.error';
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
  productionLines,
  downtimeLogs,
  users,
  operatorSessions,
  rawMaterials,
  rawMaterialTransactions,
  products
} from '../../../database/schema';
import { billOfMaterials } from '../../../database/schema';
import { TelemetryDto } from '../dto/telemetry.dto';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShiftService } from '../../master-data/shift.service';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';
import { MachineStateService } from '../../production/services/machine-state.service';
import { InventoryService } from '../../inventory/inventory.service';

export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

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
    private readonly machineStateService: MachineStateService,
    private readonly inventoryService: InventoryService,
  ) { }

  async preValidateTelemetry(userId: string, dto: TelemetryDto) {
    if (!dto.batchId || !dto.station) {
      throw new NonRetryableBusinessError('Invalid telemetry payload. Batch ID and Station are required.');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dto.batchId)) {
      throw new NonRetryableBusinessError('Invalid Batch ID format. Must be a valid UUID.');
    }

    // 1. Validate Batch Status (Industrial Locking)
    const [batch] = await db.select({ status: productionBatches.status, shiftId: productionBatches.shiftId })
      .from(productionBatches)
      .where(eq(productionBatches.id, dto.batchId))
      .limit(1);

    if (!batch) {
      throw new NonRetryableBusinessError('Associated production batch not found.');
    }

    const lockedStatuses = ['WAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'CLOSED', 'QC_PENDING'];
    if (lockedStatuses.includes(batch.status)) {
      throw new NonRetryableBusinessError(`DATA_ENTRY_FROZEN: Batch ${dto.batchId} is in ${batch.status} state and is locked.`);
    }

    // 2. Validate shift
    const shiftIdToValidate = dto.shiftId || batch.shiftId;
    if (shiftIdToValidate) {
      const isValidShift = await this.shiftService.validateShiftEntry(shiftIdToValidate, dto.loggedAt ? new Date(dto.loggedAt) : new Date());
      if (!isValidShift) {
        throw new NonRetryableBusinessError('Inactive or expired shift.');
      }
    }
  }

  async handleTelemetryLog(userId: string, dto: TelemetryDto) {
    const warnings: any[] = [];
    const log = await db.transaction(async (tx) => {
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
        throw new NonRetryableBusinessError('Batch tracking not initialized.');
      }

      const current = totalsList[0];

      // 3. Batch Integrity Validation & Retrieval
      const batch = await this.validateBatchStatus(tx, dto.batchId);

      // Auto-heal shiftId from active batch if not supplied by the operator client
      if (!dto.shiftId && batch.shiftId) {
        dto.shiftId = batch.shiftId;
      }

      const isValidShift = await this.shiftService.validateShiftEntry(dto.shiftId, dto.loggedAt ? new Date(dto.loggedAt) : new Date());
      if (!isValidShift) {
        throw new NonRetryableBusinessError('Inactive or expired shift.');
      }

      let finalPrimaryCount = dto.primaryCount;
      if (dto.splitValues && dto.splitValues.length > 0) {
        finalPrimaryCount = dto.splitValues.reduce((sum, val) => sum + val, 0);
      }

      if (!dto.isRework) {
        const warning = await this.validateProductionFlow(userId, dto.batchId, dto.station, finalPrimaryCount, current);
        if (warning) {
          warnings.push(warning);
        }
      }

      let sessionId = dto.sessionId;
      const [activeSession] = await tx.select({ id: operatorSessions.id })
        .from(operatorSessions)
        .where(and(
          eq(operatorSessions.userId, userId),
          eq(operatorSessions.lineId, dto.lineId),
          eq(operatorSessions.station, dto.station),
          eq(operatorSessions.isActive, true)
        ))
        .limit(1);

      if (activeSession) {
        sessionId = activeSession.id;
      }

      let wastageCount = Number(dto.wastageCount || 0);
      if (dto.station === 'PACKING') {
        if (dto.selectedShrinks && dto.selectedShrinks.length > 0) {
          const totalWastage = dto.selectedShrinks.reduce((sum, s) => sum + (s.wastageKg || 0), 0);
          wastageCount = totalWastage;
          dto.shrinkWastageKg = totalWastage;
        } else if (dto.shrinkWastageKg !== undefined) {
          wastageCount = dto.shrinkWastageKg;
        }
      }

      const [log] = await tx.insert(productionLogs).values({
        requestId: dto.requestId,
        batchId: dto.batchId,
        lineId: dto.lineId,
        shiftId: dto.shiftId,
        brandId: dto.brandId,
        productId: dto.productId,
        userId: userId,
        sessionId: sessionId,
        station: dto.station,
        primaryCount: finalPrimaryCount,
        splitValues: dto.splitValues || [],
        wastageCount: String(wastageCount),
        bottleLeakage: dto.bottleLeakage || 0,
        capWastage: dto.capWastage || 0,
        isRework: dto.isRework || false,
        eventType: (dto.eventType || 'NORMAL_PRODUCTION') as any,
        remarks: dto.remarks,
        capUsage: dto.capUsage || 0,
        capBoxUsage: dto.capBoxUsage || 0,
        preformUsage: dto.preformUsage || 0,
        bopRollUsage: String(dto.labelsUsed || 0),
        shrinkWeightUsed: String(dto.shrinkRollsUsed || 0),
        inkUsage: String(dto.inkUsage || 0),
        solventUsage: String(dto.solventUsage || 0),
        labelUsage: Math.round(Number(dto.labelsUsed || 0)),
        casesProduced: dto.casesProduced || 0,
        packingTypeId: dto.packingTypeId,
        finishedGoodsProduced: dto.finishedGoodsProduced || 0,
        materialCost: String(dto.materialCost || 0),
        boxCount: dto.boxCount || 0,
        secondaryPackagingCount: dto.secondaryPackagingCount || 0,

        // New Label Station Fields
        labelStickerWeight: dto.labelStickerWeight ? String(dto.labelStickerWeight) : null,
        damagedLabelWeight: dto.damagedLabelWeight ? String(dto.damagedLabelWeight) : null,
        inkChanged: dto.inkChanged || false,
        makeupChanged: dto.makeupChanged || false,
        glueUsageKg: dto.glueUsedKg ? String(dto.glueUsedKg) : null,
        rollsUsed: dto.rollsUsed || 0,

        // New Packing Station Fields
        shrinkWasteWeight: dto.shrinkWasteWeight ? String(dto.shrinkWasteWeight) : null,
        shrinkWastageKg: String(dto.shrinkWastageKg || 0),
        selectedShrinks: dto.selectedShrinks || [],
        sourceBatchNumber: dto.sourceBatchNumber || null,

        // Blowing / Material Consumption Fields
        rawMaterialId: dto.rawMaterialId || null,
        bagsUsed: dto.bagsUsed ? String(dto.bagsUsed) : null,

        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();

      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await this.processLegacyMaterialUsage(tx, log.id, dto.batchId, mat, log.loggedAt);
        }
      }

      // Traceability Audit for Printer Consumables
      if (dto.inkChanged || dto.makeupChanged) {
        await this.auditService.logAction({
          userId: userId,
          action: 'CONSUMABLES_CHANGED',
          entityType: 'production_logs',
          entityId: String(log.id),
          payload: { inkChanged: dto.inkChanged, makeupChanged: dto.makeupChanged },
          category: 'TELEMETRY'
        });
      }

      // New Enterprise Material Logic
      await this.processEnterpriseInventory(tx, dto, log.id, userId);

      // Recalculate simple inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          this.logger.error(`Background recalculateInventory failed: ${err.message}`);
        });
      }, 50);

      // Fast-fail Redis increment
      if (this.redisService.getAvailability()) {
        this.redisService.incrementCounter(dto.batchId, dto.station, finalPrimaryCount).catch(() => { });
      }

      const updateField = this.getFieldName(dto.station);
      if (updateField) {
        const setClause: any = {
          scrapTotal: sql`${batchTotals.scrapTotal} + ${wastageCount}`,

          // Enterprise Material Totals
          capTotal: sql`${batchTotals.capTotal} + ${dto.capUsage || 0}`,
          preformTotal: sql`${batchTotals.preformTotal} + ${dto.preformUsage || 0}`,
          bopRollTotal: sql`${batchTotals.bopRollTotal} + ${dto.labelsUsed || 0}`,
          shrinkWeightTotal: sql`${batchTotals.shrinkWeightTotal} + ${
            dto.selectedShrinks && dto.selectedShrinks.length > 0
              ? dto.selectedShrinks.reduce((sum, s) => sum + (s.mmUsed || 0), 0)
              : (dto.shrinkRollsUsed || 0)
          }`,
          finishedGoodsTotal: sql`${batchTotals.finishedGoodsTotal} + ${dto.finishedGoodsProduced || 0}`,
          casesTotal: sql`${batchTotals.casesTotal} + ${dto.casesProduced || 0}`,

          updatedAt: new Date()
        };

        if (updateField !== 'scrapTotal') {
          setClause[updateField] = sql`${batchTotals[updateField]} + ${finalPrimaryCount}`;
        }

        await tx.update(batchTotals)
          .set(setClause)
          .where(eq(batchTotals.batchId, dto.batchId));
      }
      
      // ── NEW: Downtime & Production Time Tracking ──
      await this.handleDowntime(tx, dto);

      this.eventsService.emitNewLog(log);
      this.eventsService.emitProductionUpdated(dto.batchId, dto.lineId);

      await this.sessionService.heartbeat(userId);

      return log;
    });

    // Decoupled Machine State Sync based on telemetry events
    let targetState = 'RUNNING';
    if (dto.eventType === 'POWER_FAILURE' || dto.eventType === 'MACHINE_BREAKDOWN') {
      targetState = 'FAULT';
    } else if (dto.eventType === 'DOWNTIME_PAUSE') {
      targetState = 'STOPPED';
    } else if (dto.eventType === 'MATERIAL_SHORTAGE' || dto.eventType === 'LOW_SPEED') {
      targetState = 'FAULT';
    }

    try {
      await this.machineStateService.updateMachineState(dto.lineId, dto.station, targetState);
    } catch (err: any) {
      this.logger.error(`Failed to update machine state for line ${dto.lineId} station ${dto.station}: ${err.message}`);
    }

    return { log, warnings };
  }

  private async processLegacyMaterialUsage(tx: any, logId: number, batchId: string, mat: any, loggedAt: Date) {
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

  private async processEnterpriseInventory(tx: any, dto: TelemetryDto, logId: number, userId: string) {
    // ── Factory-Aligned Direct Ledger Deductions (Raw Materials) ──
    let directDeductions: Array<{ materialId: string; qty: number; remarks: string }> = [];

    // 1. Blowing (Bags)
    if (dto.station === 'BLOWING' && dto.rawMaterialId && dto.bagsUsed && dto.bagsUsed > 0) {
      directDeductions.push({ materialId: dto.rawMaterialId, qty: dto.bagsUsed, remarks: `Bags used in Blowing Station (Log #${logId})` });
    }

    // 2. Capping (Boxes)
    if (dto.station === 'FILLING' && dto.rawMaterialId && dto.capBoxUsage && dto.capBoxUsage > 0) {
      directDeductions.push({ materialId: dto.rawMaterialId, qty: dto.capBoxUsage, remarks: `Boxes used in Capping Station (Log #${logId})` });
    }

    // 3. Packing (Shrink Rolls)
    if (dto.station === 'PACKING') {
      if (dto.selectedShrinks && dto.selectedShrinks.length > 0) {
        for (const shrink of dto.selectedShrinks) {
          const usage = shrink.mmUsed || 0;
          const wastage = shrink.wastageKg || 0;
          const totalDeduction = usage + wastage;
          if (totalDeduction > 0) {
            directDeductions.push({
              materialId: shrink.shrinkId,
              qty: totalDeduction,
              remarks: `Shrink roll used in Packing Station: ${shrink.shrinkName} (Usage: ${usage} KG, Wastage: ${wastage} KG) (Log #${logId})`
            });
          }
        }
      } else if (dto.rawMaterialId && dto.shrinkRollsUsed && dto.shrinkRollsUsed > 0) {
        directDeductions.push({
          materialId: dto.rawMaterialId,
          qty: dto.shrinkRollsUsed,
          remarks: `Shrink Rolls used in Packing Station (Log #${logId})`
        });
      }
    }

    // 4. Labeling (Pieces Priority-based mapping)
    if (dto.station === 'LABELING' && dto.labelsUsed && dto.labelsUsed > 0) {
      this.logger.debug(`[LABELING PAYLOAD] rawMaterialId: ${dto.rawMaterialId}, productId: ${dto.productId}, labelsUsed: ${dto.labelsUsed}`);

      let resolvedMaterialId: string | null = null;

      if (dto.rawMaterialId) {
        resolvedMaterialId = dto.rawMaterialId;
        this.logger.debug(`[LABELING RESOLUTION] Priority 1: Using provided rawMaterialId: ${resolvedMaterialId}`);
      } else if (dto.productId) {
        const productRec = await tx.select().from(products).where(eq(products.id, dto.productId));
        if (productRec.length > 0) {
          const labelName = `Label - ${productRec[0].name}`;
          const labelMat = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, labelName));
          if (labelMat.length > 0) {
            resolvedMaterialId = labelMat[0].id;
            this.logger.debug(`[LABELING RESOLUTION] Priority 2: Mapped product to label material: ${labelName} (${resolvedMaterialId})`);
          } else {
            this.logger.warn(`[LABELING RESOLUTION] Priority 3: Label material not found for product. Expected: "${labelName}"`);
          }
        }
      }

      if (resolvedMaterialId) {
        directDeductions.push({ materialId: resolvedMaterialId, qty: dto.labelsUsed, remarks: `Labels used in Labeling Station (Log #${logId})` });
      } else {
        this.logger.warn(`[LABELING RESOLUTION] Could not resolve label material for payload. Ignoring deduction.`);
      }
    }

    // 5. Labeling (Ink)
    if (dto.station === 'LABELING' && dto.inkChanged) {
      const inkMat = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, 'Ink')).limit(1);
      if (inkMat.length > 0) {
        directDeductions.push({ materialId: inkMat[0].id, qty: 1, remarks: `Ink changed in Labeling Station (Log #${logId})` });
      }
    }

    // 6. Labeling (Glue)
    if (dto.station === 'LABELING' && dto.glueUsedKg && dto.glueUsedKg > 0) {
      const glueMat = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, 'Glue')).limit(1);
      if (glueMat.length > 0) {
        directDeductions.push({ materialId: glueMat[0].id, qty: dto.glueUsedKg, remarks: `Glue used in Labeling Station (Log #${logId})` });
      } else {
        this.logger.warn(`[LABELING RESOLUTION] Glue raw material not found for deduction.`);
      }
    }

    // 6. Labeling (Makeup)
    if (dto.station === 'LABELING' && dto.makeupChanged) {
      const makeupMat = await tx.select().from(rawMaterials).where(eq(rawMaterials.name, 'Makeup')).limit(1);
      if (makeupMat.length > 0) {
        directDeductions.push({ materialId: makeupMat[0].id, qty: 1, remarks: `Makeup changed in Labeling Station (Log #${logId})` });
      }
    }

    // Apply all direct deductions to rawMaterials table
    for (const ded of directDeductions) {
      const matRecord = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, ded.materialId)).for('update');
      if (!matRecord || matRecord.length === 0) continue;

      const currentQty = Number(matRecord[0].currentStock || 0);
      const newQty = currentQty - ded.qty;

      await tx.update(rawMaterials)
        .set({ currentStock: String(newQty), updatedAt: new Date() })
        .where(eq(rawMaterials.id, ded.materialId));

      await tx.insert(rawMaterialTransactions).values({
        materialId: ded.materialId,
        type: 'CONSUMPTION',
        quantityChange: String(-ded.qty),
        balanceAfter: String(newQty),
        remarks: ded.remarks,
        performedBy: userId,
        createdAt: new Date()
      });
    }
  }

  private async validateProductionFlow(userId: string, batchId: string, station: string, count: number, totals: any) {
    const nextTotal = (totals[this.getFieldName(station)] || 0) + count;
    let message: string | null = null;
    let expectedOutput = 0;
    let actualOutput = nextTotal;

    if (station === 'FILLING' && nextTotal > totals.blowingTotal) {
      expectedOutput = Number(totals.blowingTotal || 0);
      const shortfall = nextTotal - expectedOutput;
      message = `FLOW_VIOLATION: Filling count (${nextTotal}) cannot exceed Blowing output (${expectedOutput}). Shortfall: ${shortfall} units.`;
    } else if (station === 'LABELING' && nextTotal > totals.fillingTotal) {
      expectedOutput = Number(totals.fillingTotal || 0);
      const shortfall = nextTotal - expectedOutput;
      message = `FLOW_VIOLATION: Labeling count (${nextTotal}) cannot exceed Filling output (${expectedOutput}). Shortfall: ${shortfall} units.`;
    } else if (station === 'PACKING' && nextTotal > totals.labelingTotal) {
      expectedOutput = Number(totals.labelingTotal || 0);
      const shortfall = nextTotal - expectedOutput;
      message = `FLOW_VIOLATION: Packing count (${nextTotal}) cannot exceed Labeling output (${expectedOutput}). Shortfall: ${shortfall} units.`;
    }

    if (message) {
      const variance = actualOutput - expectedOutput;

      // 1. Audit Log: logAction with category PRODUCTION and action FLOW_WARNING
      await this.auditService.logAction({
        userId,
        action: 'FLOW_WARNING',
        entityType: 'production_batches',
        entityId: batchId,
        category: 'PRODUCTION',
        payload: {
          eventType: 'FLOW_WARNING',
          workstation: station,
          batchId,
          expectedOutput,
          actualOutput,
          variance,
          createdAt: new Date()
        }
      });

      // 2. Notification: createNotification with type FLOW_VIOLATION and severity WARNING
      await this.notificationsService.createNotification(
        'FLOW_VIOLATION',
        'Flow Violation Warning',
        message,
        'WARNING',
        `flow:${batchId}`
      );

      return {
        severity: ValidationSeverity.WARNING,
        type: 'FLOW_VIOLATION',
        message
      };
    }

    return null;
  }

  private async validateBatchStatus(tx: any, batchId: string) {
    const batch = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    if (batch.length === 0) throw new NonRetryableBusinessError('Batch not found.');
    if (batch[0].status !== 'RUNNING' && batch[0].status !== 'CHANGEOVER') {
      throw new NonRetryableBusinessError(`CANNOT_LOG: Batch is currently in ${batch[0].status} state.`);
    }
    return batch[0];
  }

  private async handleDowntime(tx: any, dto: TelemetryDto) {
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

  private getRawMaterialUsageFromLog(log: any): { materialId: string; qty: number } | null {
    if (!log?.rawMaterialId) return null;

    let qty = 0;
    if (log.station === 'BLOWING') {
      qty = Number(log.bagsUsed || 0);
    } else if (log.station === 'FILLING') {
      qty = Number(log.capBoxUsage || 0);
    } else if (log.station === 'PACKING') {
      qty = Number(log.shrinkWeightUsed || 0);
    } else if (log.station === 'LABELING') {
      qty = Number(log.bopRollUsage || 0);
    }

    if (qty <= 0) return null;
    return { materialId: log.rawMaterialId, qty };
  }

  private async insertRawMaterialTransaction(
    tx: any,
    materialId: string,
    quantityChange: number,
    type: 'CONSUMPTION' | 'REVERSAL',
    remarks: string,
    performedBy?: string,
  ) {
    const [balanceRes] = await tx.select({
      sum: sql<string>`coalesce(sum(${rawMaterialTransactions.quantityChange}), '0')`
    })
      .from(rawMaterialTransactions)
      .where(eq(rawMaterialTransactions.materialId, materialId));

    const balanceAfter = Number(balanceRes.sum || 0) + quantityChange;

    await tx.insert(rawMaterialTransactions).values({
      materialId,
      type,
      quantityChange,
      balanceAfter,
      remarks,
      performedBy,
      createdAt: new Date()
    });
  }

  private async reverseRawMaterialUsage(tx: any, log: any, userId: string, remarks: string) {
    if (log.station === 'PACKING' && log.selectedShrinks && log.selectedShrinks.length > 0) {
      for (const shrink of log.selectedShrinks) {
        const usage = shrink.mmUsed || 0;
        const wastage = shrink.wastageKg || 0;
        const totalRestored = usage + wastage;
        if (totalRestored > 0) {
          const [mat] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, shrink.shrinkId)).for('update');
          const currentQty = mat ? Number(mat.currentStock || 0) : 0;
          const restoredQty = currentQty + totalRestored;

          if (mat) {
            await tx.update(rawMaterials)
              .set({ currentStock: String(restoredQty), updatedAt: new Date() })
              .where(eq(rawMaterials.id, shrink.shrinkId));
          }

          await this.insertRawMaterialTransaction(
            tx,
            shrink.shrinkId,
            totalRestored,
            'REVERSAL',
            `${remarks} - restore shrink ${shrink.shrinkName} (Usage: ${usage} KG, Wastage: ${wastage} KG)`,
            userId,
          );
        }
      }
      return;
    }

    const usage = this.getRawMaterialUsageFromLog(log);
    if (!usage) return;

    const [mat] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, usage.materialId)).for('update');
    const currentQty = mat ? Number(mat.currentStock || 0) : 0;
    const restoredQty = currentQty + usage.qty;

    if (mat) {
      await tx.update(rawMaterials)
        .set({ currentStock: restoredQty, updatedAt: new Date() })
        .where(eq(rawMaterials.id, usage.materialId));
    }

    await this.insertRawMaterialTransaction(
      tx,
      usage.materialId,
      usage.qty,
      'REVERSAL',
      remarks,
      userId,
    );
  }

  private async reconcileRawMaterialUsageChange(tx: any, beforeLog: any, afterLog: any, userId: string, remarks: string) {
    const before = this.getRawMaterialUsageFromLog(beforeLog);
    const after = this.getRawMaterialUsageFromLog(afterLog);

    if (
      before?.materialId === after?.materialId &&
      before?.qty === after?.qty
    ) {
      return;
    }

    if (before) {
      await this.insertRawMaterialTransaction(
        tx,
        before.materialId,
        before.qty,
        'REVERSAL',
        `${remarks} - reverse previous usage`,
        userId,
      );
    }

    if (after) {
      await this.insertRawMaterialTransaction(
        tx,
        after.materialId,
        -after.qty,
        'CONSUMPTION',
        `${remarks} - apply corrected usage`,
        userId,
      );
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

  async getLogHistory(batchId: string, station: string, limit = 50, operatorView = false) {
    const targetStation = station.toUpperCase();
    const updatedByUsers = alias(users, 'updatedByUsers');

    // 1. Fetch production logs for this batch and station
    const logs = await db.select({
      id: productionLogs.id,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      bottleLeakage: productionLogs.bottleLeakage,
      capWastage: productionLogs.capWastage,
      eventType: productionLogs.eventType,
      secondaryPackagingCount: productionLogs.secondaryPackagingCount,
      remarks: productionLogs.remarks,
      
      // Label specific
      bopRollUsage: productionLogs.bopRollUsage,
      labelStickerWeight: productionLogs.labelStickerWeight,
      damagedLabelWeight: productionLogs.damagedLabelWeight,
      inkChanged: productionLogs.inkChanged,
      makeupChanged: productionLogs.makeupChanged,
      glueUsageKg: productionLogs.glueUsageKg,
      rollsUsed: productionLogs.rollsUsed,
      inkUsage: productionLogs.inkUsage,
      solventUsage: productionLogs.solventUsage,
      
      // Packing specific
      shrinkWasteWeight: productionLogs.shrinkWasteWeight,
      shrinkWeightUsed: productionLogs.shrinkWeightUsed,
      sourceBatchNumber: productionLogs.sourceBatchNumber,
      shrinkWastageKg: productionLogs.shrinkWastageKg,
      selectedShrinks: productionLogs.selectedShrinks,

      // Blowing / Material Consumption
      rawMaterialId: productionLogs.rawMaterialId,
      rawMaterialName: rawMaterials.name,
      rawMaterialUnit: rawMaterials.unit,
      bagsUsed: productionLogs.bagsUsed,
      preformUsage: productionLogs.preformUsage,
      capUsage: productionLogs.capUsage,
      capBoxUsage: productionLogs.capBoxUsage,

      loggedAt: productionLogs.loggedAt,
      userName: users.name,
      updatedByName: updatedByUsers.name,
      updatedAt: productionLogs.updatedAt,
      station: productionLogs.station,
    })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(updatedByUsers, eq(productionLogs.updatedBy, updatedByUsers.id))
      .leftJoin(rawMaterials, eq(productionLogs.rawMaterialId, rawMaterials.id))
      .where(
        and(
          eq(productionLogs.batchId, batchId),
          eq(productionLogs.station, targetStation as any),
          isNull(productionLogs.deletedAt)
        )
      )
      .orderBy(desc(productionLogs.loggedAt))
      .limit(limit);

    // 2. Fetch downtime logs for this batch and station
    const downtimes = await db.select({
      id: downtimeLogs.id,
      station: downtimeLogs.station,
      reason: downtimeLogs.reason,
      startTime: downtimeLogs.startTime,
      endTime: downtimeLogs.endTime,
      remarks: downtimeLogs.remarks,
    })
      .from(downtimeLogs)
      .where(
        and(
          eq(downtimeLogs.batchId, batchId),
          eq(downtimeLogs.station, targetStation),
          isNull(downtimeLogs.deletedAt)
        )
      )
      .orderBy(desc(downtimeLogs.startTime))
      .limit(limit);

    // 3. Fetch operator sessions for this batch and station
    const sessions = await db.select({
      id: operatorSessions.id,
      station: operatorSessions.station,
      startTime: operatorSessions.startTime,
      endTime: operatorSessions.endTime,
      isActive: operatorSessions.isActive,
      endReason: operatorSessions.endReason,
      userName: users.name,
    })
      .from(operatorSessions)
      .leftJoin(users, eq(operatorSessions.userId, users.id))
      .where(
        and(
          eq(operatorSessions.batchId, batchId),
          eq(operatorSessions.station, targetStation)
        )
      )
      .orderBy(desc(operatorSessions.startTime))
      .limit(limit);

    // 4. Fetch batch details for lifecycle events (Batch started, ended)
    const [batch] = await db.select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      status: productionBatches.status,
      startTime: productionBatches.startTime,
      closedAt: productionBatches.closedAt,
      remarks: productionBatches.remarks,
      createdByName: users.name,
    })
      .from(productionBatches)
      .leftJoin(users, eq(productionBatches.createdBy, users.id))
      .where(eq(productionBatches.id, batchId))
      .limit(1);

    // 5. Fetch material assignments from materials_usage
    const materialUsageLogs = await db.select({
      id: materialsUsage.id,
      materialName: materialsUsage.materialName,
      quantity: materialsUsage.quantity,
      unit: materialsUsage.unit,
      waste: materialsUsage.waste,
      loggedAt: materialsUsage.loggedAt,
    })
      .from(materialsUsage)
      .where(
        and(
          eq(materialsUsage.batchId, batchId),
          isNull(materialsUsage.logId)
        )
      )
      .orderBy(desc(materialsUsage.loggedAt))
      .limit(limit);

    // Normalize and aggregate everything into a single feedEvents array
    const feedEvents: any[] = [];

    // Add production logs
    logs.forEach(l => {
      let source: 'OPERATOR' | 'MACHINE' | 'SYSTEM' = 'OPERATOR';
      if (['MACHINE_BREAKDOWN', 'POWER_FAILURE', 'LOW_SPEED'].includes(l.eventType)) {
        source = 'MACHINE';
      }
      feedEvents.push({
        id: `prod_log_${l.id}`,
        primaryCount: l.primaryCount,
        wastageCount: l.wastageCount,
        bottleLeakage: l.bottleLeakage,
        capWastage: l.capWastage,
        eventType: l.eventType,
        secondaryPackagingCount: l.secondaryPackagingCount,
        remarks: l.remarks,
        loggedAt: l.loggedAt,
        userName: l.userName || 'System',
        source,
        station: l.station,
        // Label specific
        bopRollUsage: l.bopRollUsage,
        labelStickerWeight: l.labelStickerWeight,
        damagedLabelWeight: l.damagedLabelWeight,
        inkChanged: l.inkChanged,
        makeupChanged: l.makeupChanged,
        glueUsageKg: l.glueUsageKg,
        inkUsage: l.inkUsage,
        solventUsage: l.solventUsage,
        // Packing specific
        shrinkWasteWeight: l.shrinkWasteWeight,
        shrinkWeightUsed: l.shrinkWeightUsed,
        sourceBatchNumber: l.sourceBatchNumber,
        shrinkWastageKg: l.shrinkWastageKg,
        selectedShrinks: l.selectedShrinks,
        // Blowing / Material Consumption
        rawMaterialId: l.rawMaterialId,
        rawMaterialName: l.rawMaterialName,
        rawMaterialUnit: l.rawMaterialUnit,
        bagsUsed: l.bagsUsed,
        preformUsage: l.preformUsage,
        capUsage: l.capUsage,
        capBoxUsage: l.capBoxUsage,
      });
    });

    // Add downtime logs
    downtimes.forEach(d => {
      feedEvents.push({
        id: `downtime_${d.id}`,
        primaryCount: 0,
        wastageCount: 0,
        eventType: d.reason,
        remarks: d.remarks || `Downtime started: ${d.reason.replace(/_/g, ' ')}`,
        loggedAt: d.startTime,
        userName: 'System',
        source: 'MACHINE',
        station: d.station,
      });
      if (d.endTime) {
        feedEvents.push({
          id: `downtime_end_${d.id}`,
          primaryCount: 0,
          wastageCount: 0,
          eventType: 'DOWNTIME_RESOLVED',
          remarks: `Downtime ended. Duration: ${Math.round((d.endTime.getTime() - d.startTime.getTime()) / 60000)} minutes`,
          loggedAt: d.endTime,
          userName: 'System',
          source: 'MACHINE',
          station: d.station,
        });
      }
    });

    // Add operator sessions — ONLY for manager/admin views (not operator terminals)
    if (!operatorView) {
      sessions.forEach(s => {
        feedEvents.push({
          id: `session_start_${s.id}`,
          primaryCount: 0,
          wastageCount: 0,
          eventType: 'OPERATOR_LOGIN',
          remarks: `Operator ${s.userName || 'Unknown'} logged into ${s.station} Station`,
          loggedAt: s.startTime,
          userName: s.userName || 'Operator',
          source: 'OPERATOR',
          station: s.station,
        });
        if (!s.isActive) {
          feedEvents.push({
            id: `session_end_${s.id}`,
            primaryCount: 0,
            wastageCount: 0,
            eventType: 'OPERATOR_LOGOUT',
            remarks: `Operator ${s.userName || 'Unknown'} logged out of ${s.station} Station. Reason: ${s.endReason || 'manual'}`,
            loggedAt: s.endTime || new Date(),
            userName: s.userName || 'Operator',
            source: 'OPERATOR',
            station: s.station,
          });
        }
      });
    }

    // Add batch lifecycle events — ONLY for manager/admin views (not operator terminals)
    if (!operatorView && batch) {
      feedEvents.push({
        id: `batch_start_${batch.id}`,
        primaryCount: 0,
        wastageCount: 0,
        eventType: 'BATCH_START',
        remarks: `Production Batch ${batch.batchCode} started by ${batch.createdByName || 'System'}`,
        loggedAt: batch.startTime,
        userName: batch.createdByName || 'System',
        source: 'SYSTEM',
        station: targetStation,
      });
      if (batch.closedAt) {
        feedEvents.push({
          id: `batch_end_${batch.id}`,
          primaryCount: 0,
          wastageCount: 0,
          eventType: 'BATCH_END',
          remarks: `Production Batch ${batch.batchCode} closed.`,
          loggedAt: batch.closedAt,
          userName: batch.createdByName || 'System',
          source: 'SYSTEM',
          station: targetStation,
        });
      }
    }

    // Add material assignments relevant to this station
    materialUsageLogs.forEach(m => {
      let isRelevant = false;
      const matName = m.materialName.toLowerCase();
      if (targetStation === 'BLOWING' && matName.includes('preform')) isRelevant = true;
      else if (targetStation === 'FILLING' && (matName.includes('cap') || matName.includes('bottle'))) isRelevant = true;
      else if (targetStation === 'LABELING' && matName.includes('label')) isRelevant = true;
      else if (targetStation === 'PACKING' && (matName.includes('shrink') || matName.includes('carton') || matName.includes('box'))) isRelevant = true;
      else if (targetStation === 'GENERAL') isRelevant = true;

      if (isRelevant) {
        feedEvents.push({
          id: `mat_usage_${m.id}`,
          primaryCount: Number(m.quantity) || 0,
          wastageCount: Number(m.waste) || 0,
          eventType: 'MATERIAL_ASSIGNMENT',
          remarks: `Assigned ${m.quantity} ${m.unit} of ${m.materialName}`,
          loggedAt: m.loggedAt,
          userName: 'Logistics',
          source: 'SYSTEM',
          station: targetStation,
        });
      }
    });

    // Sort by loggedAt descending
    feedEvents.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

    // Slice to limit
    return feedEvents.slice(0, limit);
  }

  async updateLog(logId: number, userId: string, dto: { primaryCount?: number; wastageCount?: number; remarks?: string; rawMaterialId?: string | null; bagsUsed?: number; capBoxUsage?: number; labelsUsed?: number; shrinkRollsUsed?: number; glueUsedKg?: number; rollsUsed?: number }) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).for('update');
      if (!existing) throw new BadRequestException('Production log not found.');

      // Validate Batch Status (Don't allow editing completed/closed batches)
      await this.validateBatchStatus(tx, existing.batchId);

      const nextRawMaterialId = dto.rawMaterialId !== undefined ? dto.rawMaterialId : existing.rawMaterialId;
      const nextBagsUsed = dto.bagsUsed !== undefined ? dto.bagsUsed : Number(existing.bagsUsed || 0);
      const nextCapBoxUsage = dto.capBoxUsage !== undefined ? dto.capBoxUsage : Number(existing.capBoxUsage || 0);
      const nextLabelsUsed = dto.labelsUsed !== undefined ? dto.labelsUsed : Number(existing.bopRollUsage || 0);
      const nextShrinkRollsUsed = dto.shrinkRollsUsed !== undefined ? dto.shrinkRollsUsed : Number(existing.shrinkWeightUsed || 0);

      const [updated] = await tx.update(productionLogs)
        .set({
          ...(dto.primaryCount !== undefined && { primaryCount: dto.primaryCount }),
          ...(dto.wastageCount !== undefined && { wastageCount: String(dto.wastageCount) }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
          ...(dto.rawMaterialId !== undefined && { rawMaterialId: dto.rawMaterialId }),
          ...(dto.bagsUsed !== undefined && { bagsUsed: String(dto.bagsUsed) }),
          ...(dto.capBoxUsage !== undefined && { capBoxUsage: dto.capBoxUsage }),
          ...(dto.labelsUsed !== undefined && { bopRollUsage: String(dto.labelsUsed), labelUsage: Math.round(Number(dto.labelsUsed || 0)) }),
          ...(dto.shrinkRollsUsed !== undefined && { shrinkWeightUsed: String(dto.shrinkRollsUsed) }),
          ...(dto.glueUsedKg !== undefined && { glueUsageKg: String(dto.glueUsedKg) }),
          ...(dto.rollsUsed !== undefined && { rollsUsed: dto.rollsUsed }),
          updatedBy: userId,
          updatedAt: new Date()
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      // Calculate deltas to apply atomically
      const primaryDelta = (dto.primaryCount !== undefined ? dto.primaryCount : existing.primaryCount) - existing.primaryCount;
      const wastageDelta = (dto.wastageCount !== undefined ? dto.wastageCount : Number(existing.wastageCount)) - Number(existing.wastageCount);

      if (primaryDelta !== 0 || wastageDelta !== 0) {
        const updateField = this.getFieldName(existing.station);
        const setClause: any = {
          scrapTotal: sql`${batchTotals.scrapTotal} + ${wastageDelta}`,
          updatedAt: new Date()
        };
        if (updateField && updateField !== 'scrapTotal') {
          setClause[updateField] = sql`${batchTotals[updateField]} + ${primaryDelta}`;
        }
        await tx.update(batchTotals)
          .set(setClause)
          .where(eq(batchTotals.batchId, existing.batchId));
      }

      await this.reconcileRawMaterialUsageChange(tx, existing, {
        ...existing,
        rawMaterialId: nextRawMaterialId,
        bagsUsed: String(nextBagsUsed),
        capBoxUsage: nextCapBoxUsage,
        bopRollUsage: String(nextLabelsUsed),
        shrinkWeightUsed: String(nextShrinkRollsUsed)
      }, userId, `Production Log #${logId} correction`);

      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          this.logger.error(`Background recalculateInventory failed: ${err.message}`);
        });
      }, 50);

      await this.auditService.logCorrection(
        userId,
        'production_logs',
        String(logId),
        existing,
        updated,
        dto.remarks || 'Manual Correction'
      );

      await this.eventsService.emitDataChanged('inventory', { action: 'raw_material_usage_corrected', logId });

      return updated;
    });
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

    const logs = await db.select({
      id: productionLogs.id,
      batchId: productionLogs.batchId,
      batchCode: productionBatches.batchCode,
      lineId: productionLogs.lineId,
      lineName: productionLines.name,
      station: productionLogs.station,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      bottleLeakage: productionLogs.bottleLeakage,
      capWastage: productionLogs.capWastage,
      eventType: productionLogs.eventType,
      remarks: productionLogs.remarks,

      // Label specific
      labelStickerWeight: productionLogs.labelStickerWeight,
      damagedLabelWeight: productionLogs.damagedLabelWeight,
      inkChanged: productionLogs.inkChanged,
      inkUsageMl: productionLogs.inkUsageMl,
      makeupChanged: productionLogs.makeupChanged,
      makeupUsageMl: productionLogs.makeupUsageMl,
      glueUsageKg: productionLogs.glueUsageKg,
      
      // Packing specific
      shrinkWasteWeight: productionLogs.shrinkWasteWeight,
      sourceBatchNumber: productionLogs.sourceBatchNumber,

      loggedAt: productionLogs.loggedAt,
      userName: users.name,
      updatedAt: productionLogs.updatedAt,
      deletedAt: productionLogs.deletedAt,
      status: productionLogs.status
    })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
      .leftJoin(productionLines, eq(productionLogs.lineId, productionLines.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(productionLogs.loggedAt))
      .limit(limit);

    if (logs.length === 0) return [];

    const logIds = logs.map(l => l.id);
    const idsString = logIds.join('|');
    const rmts = await db.execute(sql`
      SELECT rmt.remarks, rmt.quantity_change, rm.name, rm.unit 
      FROM raw_material_transactions rmt
      JOIN raw_materials rm ON rm.id = rmt.material_id
      WHERE rmt.remarks ~ ${'\\(Log #(' + idsString + ')\\)'}
    `);

    return logs.map(log => {
      const consumption: any[] = [];
      const pattern = new RegExp(`\\(Log #${log.id}\\)`);
      
      rmts.forEach((rmt: any) => {
        if (pattern.test(rmt.remarks)) {
          const qty = Math.abs(Number(rmt.quantity_change));
          consumption.push({
            name: rmt.name,
            quantity: qty,
            unit: rmt.unit
          });
        }
      });

      return {
        ...log,
        materialConsumption: consumption
      };
    });
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
      const setClause: any = {
        scrapTotal: sql`${batchTotals.scrapTotal} - ${existing.wastageCount}`,
        updatedAt: new Date()
      };
      if (updateField && updateField !== 'scrapTotal') {
        setClause[updateField] = sql`${batchTotals[updateField]} - ${existing.primaryCount}`;
      }
      await tx.update(batchTotals)
        .set(setClause)
        .where(eq(batchTotals.batchId, existing.batchId));

      await this.reverseRawMaterialUsage(tx, existing, userId, `VOID production log #${logId}: ${reason}`);
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          this.logger.error(`Background recalculateInventory failed: ${err.message}`);
        });
      }, 50);

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
    if (!batch) throw new NonRetryableBusinessError('Target batch not found.');
    const { log, warnings } = await this.handleTelemetryLog(userId, dto);
    return { success: true, saved: true, warnings, log };
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
