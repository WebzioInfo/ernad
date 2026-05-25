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
  operatorSessions
} from '../../../database/schema';
import { billOfMaterials } from '../../../database/schema';
import { TelemetryDto } from '../dto/telemetry.dto';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { ShiftService } from '../../master-data/shift.service';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';
import { MachineStateService } from '../../production/services/machine-state.service';

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
      const factoryId = current.factoryId;

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
        await this.validateProductionFlow(dto.station, finalPrimaryCount, current);
      }

      let sessionId = dto.sessionId;
      if (!sessionId) {
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
        sessionId: sessionId,
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

        // New Label Station Fields
        labelStickerWeight: dto.labelStickerWeight ? String(dto.labelStickerWeight) : null,
        damagedLabelWeight: dto.damagedLabelWeight ? String(dto.damagedLabelWeight) : null,
        inkChanged: dto.inkChanged || false,
        inkUsageMl: dto.inkUsageMl ? String(dto.inkUsageMl) : null,
        makeupChanged: dto.makeupChanged || false,
        makeupUsageMl: dto.makeupUsageMl ? String(dto.makeupUsageMl) : null,

        // New Packing Station Fields
        shrinkWasteWeight: dto.shrinkWasteWeight ? String(dto.shrinkWasteWeight) : null,
        sourceBatchNumber: dto.sourceBatchNumber || null,

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

      // Traceability Audit for Printer Consumables
      if (dto.inkChanged || dto.makeupChanged) {
        await this.auditService.logAction({
          userId: userId,
          action: 'CONSUMABLES_CHANGED',
          entityType: 'production_logs',
          entityId: String(log.id),
          payload: { inkChanged: dto.inkChanged, inkUsageMl: dto.inkUsageMl, makeupChanged: dto.makeupChanged, makeupUsageMl: dto.makeupUsageMl },
          category: 'TELEMETRY'
        });
      }

      // New Enterprise Material Logic
      await this.processEnterpriseInventory(tx, factoryId, dto, log.id);

      // Fast-fail Redis increment
      if (this.redisService.getAvailability()) {
        this.redisService.incrementCounter(dto.batchId, dto.station, finalPrimaryCount).catch(() => { });
      }

      const updateField = this.getFieldName(dto.station);
      if (updateField) {
        await tx.update(batchTotals)
          .set({
            [updateField]: sql`${batchTotals[updateField]} + ${finalPrimaryCount} + ${Number(dto.wastageCount || 0)}`,
            scrapTotal: sql`${batchTotals.scrapTotal} + ${dto.wastageCount}`,

            // Enterprise Material Totals
            capTotal: sql`${batchTotals.capTotal} + ${dto.capUsage || 0}`,
            preformTotal: sql`${batchTotals.preformTotal} + ${dto.preformUsage || 0}`,
            bopRollTotal: sql`${batchTotals.bopRollTotal} + ${dto.bopRollUsage || 0}`,
            shrinkWeightTotal: sql`${batchTotals.shrinkWeightTotal} + ${dto.shrinkWeightUsed || 0}`,
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

    return log;
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

    if (dto.capUsage || dto.capRejection) consumptionMap.push({ name: 'Caps', qty: Number(dto.capUsage || 0) + Number(dto.capRejection || 0), category: 'Caps' });
    if (dto.preformUsage || dto.preformRejection) consumptionMap.push({ name: 'Preforms', qty: Number(dto.preformUsage || 0) + Number(dto.preformRejection || 0), category: 'Preforms' });
    if (dto.bopRollUsage || dto.bopRejection) consumptionMap.push({ name: 'Labels', qty: Number(dto.bopRollUsage || 0) + Number(dto.bopRejection || 0), category: 'Labels' });
    if (dto.shrinkWeightUsed || dto.shrinkWeightRejected) consumptionMap.push({ name: 'Shrink Film', qty: Number(dto.shrinkWeightUsed || 0) + Number(dto.shrinkWeightRejected || 0), category: 'Shrink Rolls' });
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

      // Priority 1: BOM Auto-consumption (already resolved to exact stock ID in item.name)
      if (item.category === 'BOM_AUTO') {
        const results = await tx.select().from(inventoryStock)
          .where(eq(inventoryStock.id, item.name))
          .for('update');
        stock = results[0];
      }

      // Priority 2: Explicitly passed selectedStockId (if it matches item type)
      if (!stock && dto.selectedStockId) {
        const results = await tx.select().from(inventoryStock)
          .where(eq(inventoryStock.id, dto.selectedStockId))
          .for('update');
        const candidate = results[0];
        if (candidate && this.matchesMaterialType(candidate.itemName, item.name)) {
          stock = candidate;
        }
      }

      // Priority 3: Active Product BOM mapping lookup
      if (!stock) {
        const activeProductId = dto.productId;
        if (activeProductId) {
          const bomStocks = await tx.select({
            stock: inventoryStock
          })
          .from(billOfMaterials)
          .innerJoin(inventoryStock, eq(billOfMaterials.stockId, inventoryStock.id))
          .where(and(
            eq(billOfMaterials.productId, activeProductId),
            eq(inventoryStock.factoryId, factoryId)
          ))
          .for('update');

          for (const row of bomStocks) {
            if (this.matchesMaterialType(row.stock.itemName, item.name)) {
              stock = row.stock;
              break;
            }
          }
        }
      }

      // Priority 4: Exact Name Match
      if (!stock) {
        const stockItems = await tx.select()
          .from(inventoryStock)
          .where(and(
            eq(inventoryStock.factoryId, factoryId),
            eq(inventoryStock.itemName, item.name)
          ))
          .for('update');
        if (stockItems.length > 0) {
          stock = stockItems[0];
        }
      }

      // Priority 5: Fuzzy ILIKE Match
      if (!stock) {
        let searchPattern = '';
        const it = item.name.toLowerCase();
        if (it.includes('preform')) searchPattern = '%preform%';
        else if (it.includes('cap')) searchPattern = '%cap%';
        else if (it.includes('label') || it.includes('sticker') || it.includes('bopp')) searchPattern = '%label%';
        else if (it.includes('shrink') || it.includes('film') || it.includes('roll')) searchPattern = '%shrink%';
        else if (it.includes('ink')) searchPattern = '%ink%';
        else if (it.includes('solvent') || it.includes('makeup')) searchPattern = '%solvent%';

        if (searchPattern) {
          const fuzzyStocks = await tx.select()
            .from(inventoryStock)
            .where(and(
              eq(inventoryStock.factoryId, factoryId),
              sql`lower(${inventoryStock.itemName}) LIKE ${searchPattern}`
            ))
            .for('update');

          if (fuzzyStocks.length > 0) {
            stock = fuzzyStocks.find((s: any) => Number(s.quantity) > 0) || fuzzyStocks[0];
          }
        }
      }

      if (!stock) {
        throw new NonRetryableBusinessError(`Material stock not found for ${item.name}. Please assign stock in the Operator Panel.`);
      }

      const currentQty = Number(stock.quantity);
      if (currentQty < item.qty) {
        throw new NonRetryableBusinessError(`INSUFFICIENT_STOCK: Required ${item.qty} ${stock.unit} of ${stock.itemName}, but only ${currentQty} available.`);
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

  private matchesMaterialType(stockItemName: string, itemType: string): boolean {
    const sin = stockItemName.toLowerCase();
    const it = itemType.toLowerCase();
    if (it.includes('preform') || it.includes('blowing')) {
      return sin.includes('preform');
    }
    if (it.includes('cap') || it.includes('filling')) {
      return sin.includes('cap');
    }
    if (it.includes('label') || it.includes('sticker') || it.includes('bopp') || it.includes('labeling')) {
      return sin.includes('label') || sin.includes('sticker') || sin.includes('bopp');
    }
    if (it.includes('shrink') || it.includes('film') || it.includes('roll') || it.includes('packing')) {
      return sin.includes('shrink') || sin.includes('film') || sin.includes('roll') || sin.includes('wrap');
    }
    if (it.includes('ink')) {
      return sin.includes('ink');
    }
    if (it.includes('solvent') || it.includes('makeup')) {
      return sin.includes('solvent') || sin.includes('makeup') || sin.includes('make-up');
    }
    return false;
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
    if (batch.length === 0) throw new NonRetryableBusinessError('Batch not found.');
    if (batch[0].status !== 'RUNNING' && batch[0].status !== 'CHANGEOVER') {
      throw new NonRetryableBusinessError(`CANNOT_LOG: Batch is currently in ${batch[0].status} state.`);
    }
    return batch[0];
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

  async getLogHistory(batchId: string, station: string, limit = 50, operatorView = false) {
    const targetStation = station.toUpperCase();
    const updatedByUsers = alias(users, 'updatedByUsers');

    // 1. Fetch production logs for this batch and station
    const logs = await db.select({
      id: productionLogs.id,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      eventType: productionLogs.eventType,
      secondaryPackagingCount: productionLogs.secondaryPackagingCount,
      remarks: productionLogs.remarks,
      
      // Label specific
      labelStickerWeight: productionLogs.labelStickerWeight,
      damagedLabelWeight: productionLogs.damagedLabelWeight,
      inkChanged: productionLogs.inkChanged,
      inkUsageMl: productionLogs.inkUsageMl,
      makeupChanged: productionLogs.makeupChanged,
      makeupUsageMl: productionLogs.makeupUsageMl,
      
      // Packing specific
      shrinkWasteWeight: productionLogs.shrinkWasteWeight,
      sourceBatchNumber: productionLogs.sourceBatchNumber,

      loggedAt: productionLogs.loggedAt,
      userName: users.name,
      updatedByName: updatedByUsers.name,
      updatedAt: productionLogs.updatedAt,
      station: productionLogs.station,
    })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(updatedByUsers, eq(productionLogs.updatedBy, updatedByUsers.id))
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
      .where(eq(materialsUsage.batchId, batchId))
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
        eventType: l.eventType,
        secondaryPackagingCount: l.secondaryPackagingCount,
        remarks: l.remarks,
        loggedAt: l.loggedAt,
        userName: l.userName || 'System',
        source,
        station: l.station,
        // Label specific
        labelStickerWeight: l.labelStickerWeight,
        damagedLabelWeight: l.damagedLabelWeight,
        inkChanged: l.inkChanged,
        inkUsageMl: l.inkUsageMl,
        makeupChanged: l.makeupChanged,
        makeupUsageMl: l.makeupUsageMl,
        // Packing specific
        shrinkWasteWeight: l.shrinkWasteWeight,
        sourceBatchNumber: l.sourceBatchNumber,
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
          [updateField]: sql`${batchTotals[updateField]} + ${primaryDelta} + ${wastageDelta}`,
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
      batchCode: productionBatches.batchCode,
      lineId: productionLogs.lineId,
      lineName: productionLines.name,
      station: productionLogs.station,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      eventType: productionLogs.eventType,
      remarks: productionLogs.remarks,

      // Label specific
      labelStickerWeight: productionLogs.labelStickerWeight,
      damagedLabelWeight: productionLogs.damagedLabelWeight,
      inkChanged: productionLogs.inkChanged,
      inkUsageMl: productionLogs.inkUsageMl,
      makeupChanged: productionLogs.makeupChanged,
      makeupUsageMl: productionLogs.makeupUsageMl,
      
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
    if (!batch) throw new NonRetryableBusinessError('Target batch not found.');
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
