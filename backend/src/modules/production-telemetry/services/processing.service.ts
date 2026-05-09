import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import {
  productionLogs,
  batchTotals,
  materialsUsage,
  inventoryStock,
  inventoryTransactions,
  packagingConfigurations
} from '../../../database/schema';
import { eq, sql, and } from 'drizzle-orm';
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
  ) { }

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

        // Enterprise Extensions
        capUsage: dto.capUsage || 0,
        capRejection: dto.capRejection || 0,
        preformUsage: dto.preformUsage || 0,
        preformRejection: dto.preformRejection || 0,
        bopRollUsage: String(dto.bopRollUsage || 0),
        bopRejection: String(dto.bopRejection || 0),
        shrinkWeightUsed: String(dto.shrinkWeightUsed || 0),
        shrinkWeightRejected: String(dto.shrinkWeightRejected || 0),
        casesProduced: dto.casesProduced || 0,
        packingTypeId: dto.packingTypeId,
        finishedGoodsProduced: dto.finishedGoodsProduced || 0,
        materialCost: String(dto.materialCost || 0),
        boxCount: dto.boxCount || 0,

        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
      }).returning();

      if (dto.materials && dto.materials.length > 0) {
        for (const mat of dto.materials) {
          await this.processLegacyMaterialUsage(tx, log.id, dto.batchId, factoryId, mat, log.loggedAt);
        }
      }

      // New Enterprise Material Logic
      await this.processEnterpriseInventory(tx, factoryId, dto, log.id);

      if (!dto.isRework) {
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
            finishedGoodsTotal: sql`${batchTotals.finishedGoodsTotal} + ${dto.finishedGoodsProduced || 0}`,
            casesTotal: sql`${batchTotals.casesTotal} + ${dto.casesProduced || 0}`,

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

  private async processEnterpriseInventory(tx: any, factoryId: string, dto: ProductionTelemetryDto, logId: number) {
    const consumptionMap: Array<{ name: string; qty: number; category: string }> = [];

    if (dto.capUsage) consumptionMap.push({ name: 'Caps', qty: Number(dto.capUsage) + Number(dto.capRejection || 0), category: 'Caps' });
    if (dto.preformUsage) consumptionMap.push({ name: 'Preforms', qty: Number(dto.preformUsage) + Number(dto.preformRejection || 0), category: 'Preforms' });
    if (dto.bopRollUsage) consumptionMap.push({ name: 'Labels', qty: Number(dto.bopRollUsage) + Number(dto.bopRejection || 0), category: 'Labels' });
    if (dto.shrinkWeightUsed) consumptionMap.push({ name: 'Shrink Film', qty: Number(dto.shrinkWeightUsed) + Number(dto.shrinkWeightRejected || 0), category: 'Shrink Rolls' });

    for (const item of consumptionMap) {
      if (item.qty <= 0) continue;

      let stock;

      // Mandatory Stock Selection for Production Stability
      if (dto.selectedStockId) {
        const results = await tx.select().from(inventoryStock)
          .where(eq(inventoryStock.id, dto.selectedStockId))
          .for('update'); // PESSIMISTIC LOCKING
        stock = results[0];
      }

      if (!stock) {
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
