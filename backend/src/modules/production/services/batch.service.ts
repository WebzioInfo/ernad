import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionBatches, batchTotals, productionLines, factories,
  productBrands, products, operatorSessions
} from '../../../database/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { ProductionEventsService } from '../../../realtime/production.gateway';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private eventsService: ProductionEventsService,
    private sessionService: OperatorSessionsService
  ) {}

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

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
    const factoryId = await this.getFactoryContext();
    
    const result = await db.transaction(async (tx) => {
      const [line] = await tx.select().from(productionLines).where(eq(productionLines.id, lineId)).for('update');
      if (!line) throw new BadRequestException('Line not found.');
      if (line.status !== 'IDLE') {
        throw new BadRequestException(`Line is ${line.status}. Must be IDLE to start.`);
      }

      const finalBatchCode = batchCode || await this.generateBatchCode(tx);
      if (batchCode) {
        const [existing] = await tx.select({ id: productionBatches.id }).from(productionBatches).where(eq(productionBatches.batchCode, finalBatchCode)).limit(1);
        if (existing) throw new BadRequestException(`Batch code ${finalBatchCode} already exists.`);
      }

      const [newBatch] = await tx.insert(productionBatches).values({
        batchCode: finalBatchCode,
        factoryId,
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

      await tx.insert(batchTotals).values({
        batchId: newBatch.id,
        factoryId,
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
        inkTotal: '0',
        solventTotal: '0',
        finishedGoodsTotal: 0,
        casesTotal: 0,
      });

      // Auto-assign operators if provided
      if (operatorIds.length > 0) {
        const sessionValues = operatorIds.map(opId => ({
          userId: opId,
          lineId,
          batchId: newBatch.id,
          station: 'GENERAL',
          shiftId,
          factoryId,
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
    const factoryId = await this.getFactoryContext();

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
    .where(eq(productionBatches.factoryId, factoryId))
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
      inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER'])
    ))
    .orderBy(desc(productionBatches.startTime))
    .limit(1);

    const line = await db.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
    const lineData = line[0];

    if (!results[0]) {
      return {
        lineId,
        status: lineData?.status || 'IDLE',
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
      }
    };
  }

  async generateBatchCode(tx: any): Promise<string> {
    const now = new Date();
    const yearStr = now.getFullYear().toString().slice(-2);
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((Number(now) - Number(startOfYear)) / (1000 * 60 * 60 * 24));
    const dayStr = dayOfYear.toString().padStart(3, '0');
    
    const baseCode = `EB${yearStr}${dayStr}`;
    
    const [{ count }] = await tx.select({ count: sql<number>`count(*)` })
      .from(productionBatches)
      .where(sql`${productionBatches.batchCode} LIKE ${baseCode + '%'}`);
    
    const suffix = Number(count) === 0 ? '' : String.fromCharCode(64 + Number(count));
    return `${baseCode}${suffix}`;
  }
}
