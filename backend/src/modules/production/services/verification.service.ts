import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from '../../../database/db';
import { productionLogs, users, batchTotals, rawMaterials, rawMaterialTransactions } from '../../../database/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { AuditService } from '../../audit/audit.service';
import { InventoryService } from '../../inventory/inventory.service';
import { ProductionEventsService } from '../../../realtime/production.gateway';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly eventsService: ProductionEventsService
  ) {}

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
          rejectedBy: verifierId,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date()
        })
        .where(eq(productionLogs.id, logId))
        .returning();

      // Subtract from totals
      const updateField = this.getFieldName(log.station);
      const setClause: any = {
        scrapTotal: sql`${batchTotals.scrapTotal} - ${log.wastageCount}`,
        updatedAt: new Date()
      };
      if (updateField && updateField !== 'scrapTotal') {
        setClause[updateField] = sql`${batchTotals[updateField]} - ${log.primaryCount}`;
      }
      await tx.update(batchTotals)
        .set(setClause)
        .where(eq(batchTotals.batchId, log.batchId));

      await this.audit.logAction({
        userId: verifierId,
        action: 'LOG_REJECTION',
        entityType: 'production_logs',
        entityId: String(logId),
        category: 'PRODUCTION',
        payload: { status: 'REJECTED', reason }
      });

      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      return updated;
    });
  }

  async correctLog(logId: number, verifierId: string, newData: any, reason: string) {
    if (!reason) throw new BadRequestException('Reason is required for correction.');

    return await db.transaction(async (tx) => {
      const [oldLog] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).limit(1);
      if (!oldLog) throw new BadRequestException('Log not found');

      if (oldLog.station === 'PACKING') {
        if (newData.selectedShrinks !== undefined) {
          const totalWastage = (newData.selectedShrinks || []).reduce((sum, s: any) => sum + (s.wastageKg || 0), 0);
          newData.shrinkWastageKg = totalWastage;
          newData.wastageCount = String(totalWastage);
        } else if (newData.shrinkWastageKg !== undefined) {
          newData.wastageCount = String(newData.shrinkWastageKg);
        }
      }

      // Check date modification rules
      let newLoggedAt: Date | undefined;
      if (newData.loggedAt) {
        newLoggedAt = new Date(newData.loggedAt);
        if (newLoggedAt > new Date()) {
          throw new BadRequestException('Production date cannot be in the future.');
        }
        newData.loggedAt = newLoggedAt;
      }

      // Reconcile selected shrinks if updated for PACKING station
      let shrinkWeightDelta = 0;
      if (oldLog.station === 'PACKING' && newData.selectedShrinks !== undefined) {
        const oldShrinks = (oldLog.selectedShrinks || []) as Array<{ shrinkId: string; shrinkName: string; mmUsed: number; wastageKg?: number }>;
        const newShrinks = (newData.selectedShrinks || []) as Array<{ shrinkId: string; shrinkName: string; mmUsed: number; wastageKg?: number }>;

        // 1. Reverse old shrinks
        for (const shrink of oldShrinks) {
          const usage = shrink.mmUsed || 0;
          const wastage = shrink.wastageKg || 0;
          const totalRestored = usage + wastage;
          if (totalRestored > 0) {
            const [mat] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, shrink.shrinkId)).for('update');
            if (mat) {
              const currentStock = Number(mat.currentStock || 0);
              const restoredStock = currentStock + totalRestored;
              
              await tx.update(rawMaterials)
                .set({ currentStock: String(restoredStock), updatedAt: new Date() })
                .where(eq(rawMaterials.id, shrink.shrinkId));

              const [balanceRes] = await tx.select({
                sum: sql<string>`coalesce(sum(${rawMaterialTransactions.quantityChange}), '0')`
              })
                .from(rawMaterialTransactions)
                .where(eq(rawMaterialTransactions.materialId, shrink.shrinkId));
              const balanceAfter = Number(balanceRes.sum || 0) + totalRestored;

              await tx.insert(rawMaterialTransactions).values({
                materialId: shrink.shrinkId,
                type: 'REVERSAL',
                quantityChange: String(totalRestored),
                balanceAfter: String(balanceAfter),
                remarks: `Correction reversal for Log #${logId}: ${reason} (Usage: ${usage} KG, Wastage: ${wastage} KG)`,
                performedBy: verifierId,
                createdAt: new Date()
              });
            }
          }
        }

        // 2. Apply new shrinks
        for (const shrink of newShrinks) {
          const usage = shrink.mmUsed || 0;
          const wastage = shrink.wastageKg || 0;
          const totalDeduction = usage + wastage;
          if (totalDeduction > 0) {
            const [mat] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, shrink.shrinkId)).for('update');
            if (!mat) {
              throw new BadRequestException(`Material not found for shrink: ${shrink.shrinkName}`);
            }

            const currentStock = Number(mat.currentStock || 0);
            const newStock = currentStock - totalDeduction;

            await tx.update(rawMaterials)
              .set({ currentStock: String(newStock), updatedAt: new Date() })
              .where(eq(rawMaterials.id, shrink.shrinkId));

            const [balanceRes] = await tx.select({
              sum: sql<string>`coalesce(sum(${rawMaterialTransactions.quantityChange}), '0')`
            })
              .from(rawMaterialTransactions)
              .where(eq(rawMaterialTransactions.materialId, shrink.shrinkId));
            const balanceAfter = Number(balanceRes.sum || 0) - totalDeduction;

            await tx.insert(rawMaterialTransactions).values({
              materialId: shrink.shrinkId,
              type: 'CONSUMPTION',
              quantityChange: String(-totalDeduction),
              balanceAfter: String(balanceAfter),
              remarks: `Correction usage for Log #${logId}: ${reason} (Usage: ${usage} KG, Wastage: ${wastage} KG)`,
              performedBy: verifierId,
              createdAt: new Date()
            });
          }
        }

        const oldSum = oldShrinks.reduce((sum, s) => sum + (s.mmUsed || 0) + (s.wastageKg || 0), 0);
        const newSum = newShrinks.reduce((sum, s) => sum + (s.mmUsed || 0) + (s.wastageKg || 0), 0);
        shrinkWeightDelta = newSum - oldSum;
      }

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
      const wastageDelta = Number(newData.wastageCount !== undefined ? newData.wastageCount : oldLog.wastageCount) - Number(oldLog.wastageCount);

      if (primaryDelta !== 0 || wastageDelta !== 0 || shrinkWeightDelta !== 0) {
        const updateField = this.getFieldName(oldLog.station);
        const setClause: any = {
          scrapTotal: sql`${batchTotals.scrapTotal} + ${wastageDelta}`,
          updatedAt: new Date()
        };
        if (updateField && updateField !== 'scrapTotal') {
          setClause[updateField] = sql`${batchTotals[updateField]} + ${primaryDelta}`;
        }
        if (shrinkWeightDelta !== 0) {
          setClause.shrinkWeightTotal = sql`${batchTotals.shrinkWeightTotal} + ${shrinkWeightDelta}`;
        }
        await tx.update(batchTotals)
          .set(setClause)
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

      this.eventsService.emitProductionUpdated(updated.batchId, updated.lineId);

      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

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
