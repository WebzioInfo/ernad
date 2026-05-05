import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db } from '../db/db';
import { 
  productionBatches, productionLogs, operatorSessions,
  productionBatchesArchive, productionLogsArchive, operatorSessionsArchive,
  dataLifecycleLogs
} from '../db/schema';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';

@Injectable()
export class DataLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(DataLifecycleService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const isEnabled = this.config.get('ENABLE_DATA_CLEANUP') === 'true';
    if (!isEnabled) {
      this.logger.log('Data cleanup automation is DISABLED.');
      return;
    }

    this.logger.log('Data cleanup automation is ENABLED. Running daily check...');
    // Run daily cleanup check at 2 AM
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 2) {
        this.runCleanup(90, false);
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  async runCleanup(daysThreshold = 90, dryRun = false) {
    this.logger.log(`Starting data cleanup (Threshold: ${daysThreshold} days, Dry Run: ${dryRun})...`);

    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    // 1. Find batches to archive
    const batches = await db.select().from(productionBatches)
      .where(and(
        eq(productionBatches.status, 'CLOSED'),
        lt(productionBatches.endTime, cutoff)
      ))
      .limit(10); // Process in small chunks for safety

    if (batches.length === 0) {
      this.logger.log('No batches found for cleanup.');
      return;
    }

    for (const batch of batches) {
      try {
        await this.processBatchLifecycle(batch.id, dryRun);
      } catch (err) {
        this.logger.error(`Failed to process lifecycle for batch ${batch.id}: ${err.message}`);
      }
    }
  }

  private async processBatchLifecycle(batchId: string, dryRun: boolean) {
    this.logger.log(`Processing lifecycle for batch ${batchId}...`);

    // --- PHASE 1: ARCHIVE ---
    if (dryRun) {
      this.logger.log(`[DRY RUN] Would archive batch ${batchId}`);
      return;
    }

    await db.transaction(async (tx) => {
      // 1. Get source data
      const [batch] = await tx.select().from(productionBatches).where(eq(productionBatches.id, batchId));
      const logs = await tx.select().from(productionLogs).where(eq(productionLogs.batchId, batchId));
      const sessions = await tx.select().from(operatorSessions).where(eq(operatorSessions.batchId, batchId));

      // 2. Insert into archive
      await tx.insert(productionBatchesArchive).values({
        id: batch.id,
        batchCode: batch.batchCode,
        lineId: batch.lineId,
        productId: batch.productId,
        startTime: batch.startTime,
        endTime: batch.endTime,
        status: batch.status,
        originalData: batch
      });

      if (logs.length > 0) {
        await tx.insert(productionLogsArchive).values(
          logs.map(l => ({
            batchId: l.batchId,
            lineId: l.lineId,
            station: l.station,
            primaryCount: l.primaryCount,
            loggedAt: l.loggedAt,
            originalData: l
          }))
        );
      }

      if (sessions.length > 0) {
        await tx.insert(operatorSessionsArchive).values(
          sessions.map(s => ({
            id: s.id,
            userId: s.userId,
            lineId: s.lineId,
            station: s.station,
            startTime: s.startTime,
            endTime: s.endTime,
            originalData: s
          }))
        );
      }

      // --- PHASE 2: VERIFY ---
      const [archivedBatch] = await tx.select({ count: sql`count(*)` })
        .from(productionBatchesArchive).where(eq(productionBatchesArchive.id, batchId));
      
      const [archivedLogs] = await tx.select({ count: sql`count(*)` })
        .from(productionLogsArchive).where(eq(productionLogsArchive.batchId, batchId));

      if (Number(archivedBatch.count) !== 1 || Number(archivedLogs.count) !== logs.length) {
        throw new Error(`Archive verification failed for batch ${batchId}. Counts mismatch.`);
      }

      // --- PHASE 3: DELETE (Safe Cascading) ---
      // We rely on 'cascade' in schema where possible, but manual delete for safety if needed
      await tx.delete(productionLogs).where(eq(productionLogs.batchId, batchId));
      await tx.delete(operatorSessions).where(eq(operatorSessions.batchId, batchId));
      await tx.delete(productionBatches).where(eq(productionBatches.id, batchId));

      // --- PHASE 4: AUDIT ---
      await tx.insert(dataLifecycleLogs).values({
        action: 'CLEANUP',
        entityType: 'BATCH',
        entityId: batchId,
        status: 'SUCCESS',
        rowCount: logs.length + 1,
        details: { logsArchived: logs.length, sessionsArchived: sessions.length }
      });

      this.logger.log(`Successfully archived and deleted batch ${batchId}`);
    });

    // Optional: VACUUM ANALYZE (Requires manual raw SQL execution if possible)
    // await db.execute(sql`VACUUM ANALYZE production_logs`);
  }
}
