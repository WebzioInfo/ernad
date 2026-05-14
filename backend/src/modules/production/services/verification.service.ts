import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from '../../../database/db';
import { productionLogs, users, batchTotals } from '../../../database/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly audit: AuditService) {}

  async verifyLog(logId: number, verifierId: string, remarks?: string) {
    return await db.transaction(async (tx) => {
      const [log] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).limit(1);
      if (!log) throw new BadRequestException('Log not found');

      if (log.userId === verifierId) {
        throw new ForbiddenException('Operators cannot verify their own logs.');
      }

      const [updated] = await tx.update(productionLogs)
        .set({
          status: 'VERIFIED',
          verifiedBy: verifierId,
          verifiedAt: new Date(),
          verificationReason: remarks,
          updatedAt: new Date()
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      await this.audit.logAction({
        userId: verifierId,
        action: 'LOG_VERIFICATION',
        entityType: 'production_logs',
        entityId: String(logId),
        category: 'PRODUCTION',
        payload: { status: 'VERIFIED', remarks }
      });

      return updated;
    });
  }

  async rejectLog(logId: number, verifierId: string, reason: string) {
    if (!reason) throw new BadRequestException('Reason is required for rejection.');

    return await db.transaction(async (tx) => {
      const [log] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).limit(1);
      if (!log) throw new BadRequestException('Log not found');

      const [updated] = await tx.update(productionLogs)
        .set({
          status: 'REJECTED',
          verifiedBy: verifierId,
          verifiedAt: new Date(),
          verificationReason: reason,
          updatedAt: new Date()
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      // Subtract from totals
      const updateField = this.getFieldName(log.station);
      await tx.update(batchTotals)
        .set({
          [updateField]: sql`${batchTotals[updateField]} - ${log.primaryCount}`,
          scrapTotal: sql`${batchTotals.scrapTotal} - ${log.wastageCount}`,
          updatedAt: new Date()
        })
        .where(eq(batchTotals.batchId, log.batchId));

      await this.audit.logAction({
        userId: verifierId,
        action: 'LOG_REJECTION',
        entityType: 'production_logs',
        entityId: String(logId),
        category: 'PRODUCTION',
        payload: { status: 'REJECTED', reason }
      });

      return updated;
    });
  }

  async correctLog(logId: number, verifierId: string, newData: any, reason: string) {
    if (!reason) throw new BadRequestException('Reason is required for correction.');

    return await db.transaction(async (tx) => {
      const [oldLog] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).limit(1);
      if (!oldLog) throw new BadRequestException('Log not found');

      const [updated] = await tx.update(productionLogs)
        .set({
          ...newData,
          status: 'CORRECTED',
          updatedBy: verifierId,
          updatedAt: new Date(),
          verificationReason: reason
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      // Apply deltas to totals
      const primaryDelta = (newData.primaryCount !== undefined ? newData.primaryCount : oldLog.primaryCount) - oldLog.primaryCount;
      const wastageDelta = (newData.wastageCount !== undefined ? newData.wastageCount : oldLog.wastageCount) - oldLog.wastageCount;

      if (primaryDelta !== 0 || wastageDelta !== 0) {
        const updateField = this.getFieldName(oldLog.station);
        await tx.update(batchTotals)
          .set({
            [updateField]: sql`${batchTotals[updateField]} + ${primaryDelta} + ${wastageDelta}`,
            scrapTotal: sql`${batchTotals.scrapTotal} + ${wastageDelta}`,
            updatedAt: new Date()
          })
          .where(eq(batchTotals.batchId, oldLog.batchId));
      }

      await this.audit.logCorrection(
        verifierId,
        'production_logs',
        String(logId),
        oldLog,
        updated,
        reason
      );

      return updated;
    });
  }

  private getFieldName(station: string): any {
    const map: any = {
      BLOWING: 'blowingTotal',
      FILLING: 'fillingTotal',
      LABELING: 'labelingTotal',
      PACKING: 'packingTotal',
      QC: 'scrapTotal'
    };
    return map[station] || 'scrapTotal';
  }
}
