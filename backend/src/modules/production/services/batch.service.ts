import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import {
  productionBatches, batchTotals, productionLines,
  productBrands, products, operatorSessions, billOfMaterials, inventoryStock
} from '../../../database/schema';
import { eq, and, sql, desc, inArray, or } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private sessionService: OperatorSessionsService
  ) { }

  async startBatch(
    lineId: string,
    brandId: string,
    productId: string,
    shiftId: string,
    createdBy: string,
    batchCode?: string,
    remarks?: string,
    startTime?: string,
    operatorIds: string[] = [],
    targetQuantity?: number
  ) {
    const result = await db.transaction(async (tx) => {
      const [line] = await tx.select().from(productionLines).where(eq(productionLines.id, lineId)).for('update');
      if (!line) throw new BadRequestException('Line not found.');
      if (line.status !== 'IDLE') {
        throw new BadRequestException(`Line is ${line.status}. Must be IDLE to start.`);
      }

      // Check if a BOM is configured for the product
      const bomItems = await tx.select()
        .from(billOfMaterials)
        .where(eq(billOfMaterials.productId, productId));

      if (bomItems.length > 0) {
        for (const bom of bomItems) {
          const [stock] = await tx.select()
            .from(inventoryStock)
            .where(eq(inventoryStock.id, bom.stockId))
            .limit(1);

          if (!stock) {
            throw new BadRequestException(`Cannot start production. Mapped stock item (ID: ${bom.stockId}) not found in the factory.`);
          }
          if (Number(stock.quantity) <= 0) {
            throw new BadRequestException(`Cannot start production. Insufficient stock for BOM item: ${stock.itemName} (Available: ${stock.quantity} ${stock.unit}). Please assign or update stock in Operator Panel.`);
          }
        }
      }

      const finalBatchCode = batchCode || await this.generateBatchCode(tx);

      // Idempotently reuse global daily batch if it exists for THIS line
      const [existingBatch] = await tx.select().from(productionBatches)
        .where(and(
          eq(productionBatches.batchCode, finalBatchCode),
          eq(productionBatches.lineId, lineId)
        ))
        .limit(1);

      let newBatch;
      
      if (existingBatch) {
        newBatch = existingBatch;
        
        if (existingBatch.status !== 'RUNNING' && existingBatch.status !== 'CHANGEOVER') {
          await tx.update(productionBatches)
            .set({ status: 'RUNNING' })
            .where(eq(productionBatches.id, existingBatch.id));
        }
      } else {
        const [insertedBatch] = await tx.insert(productionBatches).values({
          batchCode: finalBatchCode,
          lineId,
          brandId,
          productId,
          shiftId,
          targetQuantity,
          startTime: startTime ? new Date(startTime) : new Date(),
          status: 'RUNNING',
          createdBy,
          remarks,
        }).returning();
        
        newBatch = insertedBatch;

        await tx.insert(batchTotals).values({
          batchId: newBatch.id,
          lineId,
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
      }

      // Auto-assign operators if provided
      if (operatorIds.length > 0) {
        const sessionValues = operatorIds.map(opId => ({
          userId: opId,
          lineId,
          batchId: newBatch.id,
          station: 'GENERAL',
          shiftId,
          isActive: true
        }));
        await tx.insert(operatorSessions).values(sessionValues);
      }

      await tx.update(productionLines).set({ status: 'RUNNING' }).where(eq(productionLines.id, lineId));

      return newBatch;
    });

    await this.eventsService.emitLineStatus(lineId, 'RUNNING');
    await this.eventsService.emitProductionUpdated(result.id, lineId);

    return result;
  }

  async getBatches(limit = 50) {
    const results = await db.select({
      batch: productionBatches,
      line: productionLines,
      product: products,
      brand: productBrands,
    })
      .from(productionBatches)
      .innerJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
      .leftJoin(products, eq(productionBatches.productId, products.id))
      .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
      .orderBy(desc(productionBatches.startTime))
      .limit(limit);

    return results.map(row => ({
      ...row.batch,
      line: row.line,
      product: row.product || { name: 'Unknown Product', id: null, targetBPM: 120 },
      brand: row.brand || { name: 'Unknown Brand', id: null }
    }));
  }

  async getActiveBatch(lineId: string) {
    try {
      const line = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
      const lineData = line[0];
      
      if (!lineData) {
        return { lineId, status: 'IDLE', batch: null, error: 'Line not found' };
      }

      if (lineData.status !== 'RUNNING' && lineData.status !== 'CHANGEOVER') {
        return {
          lineId,
          status: lineData.status,
          batch: null
        };
      }

      const results = await db.select({
        batch: productionBatches,
        brand: productBrands,
        product: products,
        totals: batchTotals
      })
        .from(productionBatches)
        .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
        .leftJoin(products, eq(productionBatches.productId, products.id))
        .leftJoin(batchTotals, eq(productionBatches.id, batchTotals.batchId))
        .where(and(
          eq(productionBatches.lineId, lineId),
          or(
            eq(productionBatches.status, 'RUNNING'),
            eq(productionBatches.status, 'CHANGEOVER')
          )
        ))
        .orderBy(desc(productionBatches.startTime))
        .limit(1);

      if (!results[0]) {
        return {
          lineId,
          status: lineData.status,
          batch: null
        };
      }

      const { batch, brand, product, totals } = results[0];

      return {
        lineId,
        status: lineData?.status || batch.status,
        target: batch.targetQuantity || 0,
        actual: totals?.packingTotal || totals?.finishedGoodsTotal || 0,
        rejectionTotal: totals?.scrapTotal || 0,
        batch: {
          id: batch.id,
          batchCode: batch.batchCode,
          status: batch.status,
          startTime: batch.startTime,
          productId: batch.productId,
          brandId: batch.brandId,
          shiftId: batch.shiftId,
          productName: product?.name || 'Unknown Product',
          brandName: brand?.name || 'Unknown Brand'
        },
        materialTotals: {
          preformTotal: totals?.preformTotal || 0,
          capTotal: totals?.capTotal || 0,
          labelTotal: totals?.bopRollTotal || 0,
          shrinkTotal: totals?.shrinkWeightTotal || 0,
          scrapTotal: totals?.scrapTotal || 0
        }
      };
    } catch (error) {
      console.error(`[BatchService] getActiveBatch error for line ${lineId}:`, error);
      const line = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
      return {
        lineId,
        status: line[0]?.status || 'IDLE',
        batch: null,
        error: 'System encountered an error retrieving active batch.'
      };
    }
  }

  async generateBatchCode(tx?: any): Promise<string> {
    const timezone = process.env.FACTORY_TIMEZONE || 'Asia/Kolkata';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')!.value);
    
    const targetDate = new Date(Date.UTC(year, month, day));
    const startOfYear = new Date(Date.UTC(year, 0, 0));
    const diff = targetDate.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const yearStr = year.toString().slice(-2);
    const dayStr = dayOfYear.toString().padStart(3, '0');
    
    return `EB${yearStr}${dayStr}`;
  }
}
