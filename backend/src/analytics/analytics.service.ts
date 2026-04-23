import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/db';
import { factoryLogs, productionBatches, batchTotals, shifts } from '../db/schema';
import { eq, and, sql, avg, sum } from 'drizzle-orm';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  async getLinePerformance(lineId: string, shiftId?: string) {
    const filters = [eq(batchTotals.lineId, lineId)];
    if (shiftId) filters.push(eq(productionBatches.shiftId, shiftId));

    const aggregated = await db.select({
      blowingTotal: sum(batchTotals.blowingTotal),
      fillingTotal: sum(batchTotals.fillingTotal),
      labelingTotal: sum(batchTotals.labelingTotal),
      packingTotal: sum(batchTotals.packingTotal),
    })
    .from(batchTotals)
    .innerJoin(productionBatches, eq(batchTotals.batchId, productionBatches.id))
    .where(and(...filters));

    const rawStats = aggregated[0] || { blowingTotal: 0, fillingTotal: 0, labelingTotal: 0, packingTotal: 0 };
    
    // Map to expected format
    const stats = [
      { station: 'BLOWING', totalPrimary: Number(rawStats.blowingTotal || 0), totalWastage: 0 },
      { station: 'FILLING', totalPrimary: Number(rawStats.fillingTotal || 0), totalWastage: 0 },
      { station: 'LABELING', totalPrimary: Number(rawStats.labelingTotal || 0), totalWastage: 0 },
      { station: 'PACKING', totalPrimary: Number(rawStats.packingTotal || 0), totalWastage: 0 }
    ];

    return {
      lineId,
      shiftId: shiftId || 'ALL',
      stats,
      generatedAt: new Date()
    };
  }

  async getGlobalEfficiency() {
    // Calculate aggregate efficiency across all active lines
    const activeTotals = await db.select().from(batchTotals);
    
    return activeTotals.map(t => ({
      lineId: t.lineId,
      efficiency: t.packingTotal > 0 ? (t.packingTotal / (t.blowingTotal || 1)) * 100 : 0,
      wastage: t.blowingTotal - t.packingTotal
    }));
  }

  async getFillingAnomalies(batchId: string) {
    const totals = await db.select().from(batchTotals).where(eq(batchTotals.batchId, batchId)).limit(1);
    if (!totals.length) return { anomalyCount: 0, details: [] };

    const { blowingTotal, fillingTotal } = totals[0];
    const expectedFilling = blowingTotal * 0.99; // 1% allowed wastage
    
    if (fillingTotal > blowingTotal) {
      const details = 'Filling count exceeds Blowing count.';
      await this.notificationsService.createNotification('ANOMALY', 'Flow Violation Detected', details, 'CRITICAL');
      return { anomalyCount: 1, severity: 'HIGH', details: [details] };
    } else if (fillingTotal < expectedFilling && fillingTotal > 0) {
      const details = 'High wastage detected between Blowing and Filling.';
      await this.notificationsService.createNotification('ANOMALY', 'High Wastage Detected', details, 'WARNING');
      return { anomalyCount: 1, severity: 'MEDIUM', details: [details] };
    }
    return { anomalyCount: 0, severity: 'LOW', details: [] };
  }

  async getPredictiveInsights(batchId: string) {
    const batch = await db.select().from(productionBatches).where(eq(productionBatches.id, batchId)).limit(1);
    if (!batch.length) return { status: 'INVALID_BATCH', currentBPM: 0 };
    
    // Fetch the shift for this batch
    const shiftResult = await db.select().from(shifts).where(eq(shifts.id, batch[0].shiftId)).limit(1);
    let shiftEndTime = new Date(Date.now() + 8 * 3600000); // fallback 8 hours
    if (shiftResult.length > 0) {
      const [hours, minutes] = shiftResult[0].endTime.split(':');
      const now = new Date();
      shiftEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));
      if (shiftEndTime < now) {
         // shift crosses midnight
         shiftEndTime.setDate(shiftEndTime.getDate() + 1);
      }
    }

    const logs = await db.select().from(factoryLogs)
      .where(and(eq(factoryLogs.batchId, batchId), eq(factoryLogs.station, 'PACKING')))
      .orderBy(sql`${factoryLogs.loggedAt} DESC`)
      .limit(50);

    if (logs.length < 2) return { status: 'INSUFFICIENT_DATA', currentBPM: 0 };

    const first = logs[logs.length - 1];
    const last = logs[0];
    const timeDiffMin = (new Date(last.loggedAt).getTime() - new Date(first.loggedAt).getTime()) / 60000;
    
    const unitsInWindow = logs.reduce((sum, log) => sum + log.primaryCount, 0);
    const currentBPM = timeDiffMin > 0 ? (unitsInWindow / timeDiffMin) : 0;

    if (currentBPM === 0) return { status: 'STALLED', currentBPM: 0, confidenceScore: 0 };

    const confidenceScore = Math.min(logs.length / 50, 0.95);

    return {
      currentBPM: Math.round(currentBPM),
      estimatedCompletionTime: shiftEndTime,
      confidenceScore,
      trend: currentBPM > 80 ? 'OPTIMAL' : 'SLOWDOWN' // using 80 BPM as a standard threshold
    };
  }
}
