import { 
  Controller, Get, Param, UseGuards, Logger, Patch, Delete, 
  Body, Req, ParseIntPipe, BadRequestException, NotFoundException 
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuditService } from './audit.service';
import { db } from '../../database/db';
import { 
  productionBatches, productionLogs, downtimeLogs, 
  auditLogs, users, products, productionLines, labTests,
  inventoryLedger
} from '../../database/schema';
import { eq, and, desc, inArray, or } from 'drizzle-orm';

@Controller('forensics')
@UseGuards(AuthGuard, RolesGuard)
export class ForensicsController {
  private readonly logger = new Logger('ForensicsController');

  constructor(private readonly auditService: AuditService) {}

  @Get('batch/:batchId')
  @Permissions('analytics:view')
  async getBatchForensics(@Param('batchId') batchId: string) {
    this.logger.log(`[FORENSICS] Investigative deep-dive triggered for Batch ${batchId}`);

    // 1. Core Batch Profile
    const [batch] = await db.select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      status: productionBatches.status,
      startTime: productionBatches.startTime,
      endTime: productionBatches.endTime,
      adjustedStartTime: productionBatches.adjustedStartTime,
      product: products.name,
      line: productionLines.name,
      remarks: productionBatches.remarks,
      isDeleted: productionBatches.deletedAt
    })
    .from(productionBatches)
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
    .where(eq(productionBatches.id, batchId));

    if (!batch) {
      return { error: 'Batch not found in industrial records' };
    }

    // 2. Production Ledger (All entries including soft-deleted)
    const logs = await db.select({
      id: productionLogs.id,
      station: productionLogs.station,
      primaryCount: productionLogs.primaryCount,
      wastageCount: productionLogs.wastageCount,
      loggedAt: productionLogs.loggedAt,
      operator: users.name,
      operatorUsername: users.username,
      isDeleted: productionLogs.deletedAt,
      deletedReason: productionLogs.deletedReason,
      updatedAt: productionLogs.updatedAt,
      updatedBy: productionLogs.updatedBy
    })
    .from(productionLogs)
    .leftJoin(users, eq(productionLogs.userId, users.id))
    .where(eq(productionLogs.batchId, batchId))
    .orderBy(desc(productionLogs.loggedAt));

    const logIds = logs.map(l => String(l.id));

    // 3. Downtime History
    const downtimes = await db.select()
      .from(downtimeLogs)
      .where(eq(downtimeLogs.batchId, batchId))
      .orderBy(desc(downtimeLogs.startTime));

    // 4. Material Usage Reconciliation
    const materialUsage = await db.select()
      .from(inventoryLedger)
      .where(eq(inventoryLedger.batchId, batchId))
      .orderBy(desc(inventoryLedger.occurredAt));

    // 5. QC DNA
    const qcRecords = await db.select()
      .from(labTests)
      .where(eq(labTests.batchId, batchId))
      .orderBy(desc(labTests.testedAt));

    // 6. Audit Trail (Corrections & Access Events)
    const auditTrail = await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      actor: users.name,
      role: users.jobTitle,
      payload: auditLogs.payload,
      occurredAt: auditLogs.occurredAt,
      category: auditLogs.category
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(or(
      eq(auditLogs.entityId, batchId),
      logIds.length > 0 ? inArray(auditLogs.entityId, logIds) : eq(auditLogs.id, -1)
    ))
    .orderBy(desc(auditLogs.occurredAt));

    return {
      metadata: {
        batchId,
        generatedAt: new Date(),
        inspector: 'Enterprise Forensic Engine'
      },
      batch,
      timeline: logs,
      downtimes,
      materialUsage,
      qcRecords,
      auditTrail
    };
  }

  @Patch('log/:logId')
  @Permissions('production:start')
  async correctLog(
    @Param('logId', ParseIntPipe) logId: number,
    @Body() body: { primaryCount?: number; wastageCount?: number; reason: string },
    @Req() req: any
  ) {
    const userId = req.user.sub;
    if (!body.reason) throw new BadRequestException('Audit reason is mandatory for corrections');

    const [original] = await db.select().from(productionLogs).where(eq(productionLogs.id, logId));
    if (!original) throw new NotFoundException('Industrial record not found');

    await db.update(productionLogs)
      .set({
        primaryCount: body.primaryCount ?? original.primaryCount,
        wastageCount: body.wastageCount ?? original.wastageCount,
        updatedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(productionLogs.id, logId));

    await this.auditService.logCorrection(
      userId,
      'production_logs',
      String(logId),
      original,
      { primaryCount: body.primaryCount, wastageCount: body.wastageCount },
      body.reason
    );

    return { success: true, message: 'Forensic correction applied and logged' };
  }

  @Delete('log/:logId')
  @Permissions('production:start')
  async softDeleteLog(
    @Param('logId', ParseIntPipe) logId: number,
    @Body('reason') reason: string,
    @Req() req: any
  ) {
    const userId = req.user.sub;
    if (!reason) throw new BadRequestException('Formal reason is mandatory for record removal');

    await db.update(productionLogs)
      .set({
        deletedAt: new Date(),
        deletedBy: userId,
        deletedReason: reason
      })
      .where(eq(productionLogs.id, logId));

    await this.auditService.logAction({
      userId,
      action: 'FORENSIC_REMOVAL',
      entityType: 'production_logs',
      entityId: String(logId),
      category: 'PRODUCTION',
      payload: { reason }
    });

    return { success: true, message: 'Record formally removed from active execution' };
  }
}
