import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../database/db';
import { 
  productionBatches, 
  batchTotals, 
  downtimeLogs, 
  products 
} from '../../../database/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface OeeMetrics {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  totalProduced: number;
  goodProduced: number;
  rejections: number;
  downtimeMinutes: number;
  plannedTimeMinutes: number;
}

@Injectable()
export class OeeService {
  private readonly logger = new Logger(OeeService.name);

  async calculateBatchOee(batchId: string): Promise<OeeMetrics> {
    // 1. Fetch Batch and Product Context
    const [batchData] = await db.select({
      batch: productionBatches,
      product: products,
      totals: batchTotals
    })
    .from(productionBatches)
    .innerJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(batchTotals, eq(batchTotals.batchId, productionBatches.id))
    .where(eq(productionBatches.id, batchId))
    .limit(1);

    if (!batchData) throw new Error('Batch not found');

    const { batch, product, totals } = batchData;

    // 2. Calculate Time Metrics
    const startTime = new Date(batch.adjustedStartTime || batch.startTime);
    const endTime = batch.endTime ? new Date(batch.endTime) : new Date();
    const plannedTimeMinutes = Math.max(1, (endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // 3. Fetch Downtime
    const downtimes = await db.select({
      duration: downtimeLogs.durationMinutes
    })
    .from(downtimeLogs)
    .where(eq(downtimeLogs.batchId, batchId));

    const totalDowntime = downtimes.reduce((sum, d) => sum + (d.duration || 0), 0);
    const operatingTime = Math.max(0, plannedTimeMinutes - totalDowntime);

    // 4. Availability = Operating Time / Planned Production Time
    const availability = plannedTimeMinutes > 0 ? operatingTime / plannedTimeMinutes : 0;

    // 5. Performance = (Total Pieces) / (Operating Time * Ideal Run Rate)
    // targetBPM is Bottles Per Minute
    const totalProduced = totals?.blowingTotal || 0; // Primary output at first station
    const idealOutput = operatingTime * product.targetBPM;
    const performance = (operatingTime > 0 && idealOutput > 0) ? totalProduced / idealOutput : 0;

    // 6. Quality = Good Pieces / Total Pieces
    const goodProduced = totals?.packingTotal || 0; // Final packed pieces
    const rejections = totals?.scrapTotal || 0;
    const quality = totalProduced > 0 ? goodProduced / totalProduced : 0;

    // 7. Final OEE
    const oee = availability * performance * quality;

    return {
      availability: Number((availability * 100).toFixed(2)),
      performance: Number((Math.min(1, performance) * 100).toFixed(2)), // Cap performance at 100% for OEE
      quality: Number((quality * 100).toFixed(2)),
      oee: Number((oee * 100).toFixed(2)),
      totalProduced,
      goodProduced,
      rejections,
      downtimeMinutes: totalDowntime,
      plannedTimeMinutes: Math.round(plannedTimeMinutes)
    };
  }

  async getLineOee(lineId: string, days = 1): Promise<any> {
    // Aggregation logic for line-wise OEE trends
    const recentBatches = await db.select({ id: productionBatches.id })
      .from(productionBatches)
      .where(and(
        eq(productionBatches.lineId, lineId),
        sql`${productionBatches.createdAt} >= NOW() - INTERVAL '${days} day'`
      ));

    if (recentBatches.length === 0) return null;

    const metrics = await Promise.all(recentBatches.map(b => this.calculateBatchOee(b.id)));
    
    // Average metrics
    const avg = metrics.reduce((acc, m) => ({
      oee: acc.oee + m.oee,
      availability: acc.availability + m.availability,
      performance: acc.performance + m.performance,
      quality: acc.quality + m.quality
    }), { oee: 0, availability: 0, performance: 0, quality: 0 });

    return {
      oee: Number((avg.oee / metrics.length).toFixed(2)),
      availability: Number((avg.availability / metrics.length).toFixed(2)),
      performance: Number((avg.performance / metrics.length).toFixed(2)),
      quality: Number((avg.quality / metrics.length).toFixed(2)),
      batchCount: metrics.length
    };
  }
}
