import { 
  Controller, Get, Param, UseGuards, Logger, Patch, Delete, 
  Body, Req, ParseIntPipe, BadRequestException, NotFoundException 
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { db } from '../../database/db';
import { 
  productionBatches, productionLogs, downtimeLogs, 
  auditLogs, users, products, productionLines, qualityChecks,
  inventoryLedger, salesOrders, salesOrderItems, customers,
  operatorSessions, roles, userRoles
} from '../../database/schema';
import { eq, and, desc, inArray, or, sql, isNull } from 'drizzle-orm';

@Controller('forensics')
@UseGuards(AuthGuard, RolesGuard)
export class ForensicsController {
  private readonly logger = new Logger('ForensicsController');

  constructor(
    private readonly auditService: AuditService,
    private readonly analyticsService: AnalyticsService
  ) {}

  @Get('batch/:batchId')
  @Permissions('analytics:view')
  async getBatchForensics(@Req() req: any, @Param('batchId') batchId: string) {
    const callerRoles = req.user?.roles || [];
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');

    this.logger.log(`[FORENSICS] Investigative deep-dive triggered for Batch ${batchId} by ${req.user.username}`);

    // ── 1. Core Batch Profile ────────────────────────────────────────────────
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
      isLocked: productionBatches.isLocked,
      isDeleted: productionBatches.deletedAt,
      factoryId: productionBatches.factoryId,
      brandId: productionBatches.brandId,
    })
    .from(productionBatches)
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(productionLines, eq(productionBatches.lineId, productionLines.id))
    .where(eq(productionBatches.id, batchId));

    if (!batch) {
      return { error: 'Batch not found in industrial records' };
    }

    // ── 2. Production Ledger (all entries, including soft-deleted) ───────────
    let timeline: any[] = [];
    try {
      timeline = await db.select({
        id: productionLogs.id,
        station: productionLogs.station,
        primaryCount: productionLogs.primaryCount,
        wastageCount: productionLogs.wastageCount,
        secondaryPackagingCount: productionLogs.secondaryPackagingCount,
        eventType: productionLogs.eventType,
        isRework: productionLogs.isRework,
        loggedAt: productionLogs.loggedAt,
        operator: users.name,
        operatorUsername: users.username,
        operatorId: users.id,
        isDeleted: productionLogs.deletedAt,
        deletedReason: productionLogs.deletedReason,
        updatedAt: productionLogs.updatedAt,
        updatedBy: productionLogs.updatedBy,
        remarks: productionLogs.remarks,
      })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .where(eq(productionLogs.batchId, batchId))
      .orderBy(desc(productionLogs.loggedAt));
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to fetch production logs for ${batchId}:`, err);
    }

    const logIds = timeline.map(l => String(l.id));

    // ── 3. Downtime History ──────────────────────────────────────────────────
    let downtimes: any[] = [];
    try {
      downtimes = await db.select()
        .from(downtimeLogs)
        .where(eq(downtimeLogs.batchId, batchId))
        .orderBy(desc(downtimeLogs.startTime));
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to fetch downtime logs for ${batchId}:`, err);
    }

    // ── 4. Material Usage (inventory_ledger movements tied to this batch) ────
    let materialUsage: any[] = [];
    try {
      materialUsage = await db.select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.batchId, batchId))
        .orderBy(desc(inventoryLedger.occurredAt));
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to fetch inventory ledger for ${batchId}:`, err);
    }

    // ── 5. Inventory Variance (BOM vs actual) ─────────────────────────────
    let inventoryVariance: any[] = [];
    try {
      inventoryVariance = await this.analyticsService.getInventoryVariance(batchId);
    } catch (err) {
      this.logger.warn(`[FORENSICS] Inventory variance unavailable for ${batchId}:`, err);
    }

    // ── 6. QC DNA (quality_checks in logs.ts) ────────────────────────────────
    // Schema: quality_checks.inspector_id → users.id, quality_checks.batch_id
    let qcRecords: any[] = [];
    try {
      qcRecords = await db.select({
        id: qualityChecks.id,
        checkType: qualityChecks.checkType,
        result: qualityChecks.result,
        parameters: qualityChecks.parameters,
        reportUrl: qualityChecks.reportUrl,
        remarks: qualityChecks.remarks,
        checkedAt: qualityChecks.checkedAt,
        userName: users.name,
        inspectorId: users.id,
      })
      .from(qualityChecks)
      .leftJoin(users, eq(qualityChecks.inspectorId, users.id))
      .where(eq(qualityChecks.batchId, batchId))
      .orderBy(desc(qualityChecks.checkedAt));
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to fetch QC records for ${batchId}:`, err);
    }

    // ── 7. Telemetry Trends (hourly aggregation) ─────────────────────────────
    let telemetry: any[] = [];
    try {
      telemetry = await db.select({
        time: sql`date_trunc('hour', ${productionLogs.loggedAt})`,
        count: sql<number>`COALESCE(SUM(${productionLogs.primaryCount}), 0)`,
        wastage: sql<number>`COALESCE(SUM(${productionLogs.wastageCount}), 0)`,
      })
      .from(productionLogs)
      .where(and(eq(productionLogs.batchId, batchId), isNull(productionLogs.deletedAt)))
      .groupBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`)
      .orderBy(sql`date_trunc('hour', ${productionLogs.loggedAt})`);
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to build telemetry trends for ${batchId}:`, err);
    }

    // ── 8. Operator Accountability ───────────────────────────────────────────
    let accountability: any[] = [];
    try {
      accountability = await db.select({
        name: users.name,
        username: users.username,
        userId: users.id,
        totalEntries: sql<number>`count(*)`,
        lastActive: sql<Date>`max(${productionLogs.loggedAt})`,
      })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .where(eq(productionLogs.batchId, batchId))
      .groupBy(users.name, users.username);
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to build accountability matrix for ${batchId}:`, err);
    }

    // ── 9. Sales Traceability ────────────────────────────────────────────────
    // Schema: sales_order_items.batch_id (FK → production_batches.id) – sales.ts line 48
    // WRAPPED in try/catch: sales linkage is optional; many batches have none.
    let salesMapping: any[] = [];
    try {
      salesMapping = await db.select({
        orderNumber: salesOrders.orderNumber,
        customer: customers.name,
        quantity: salesOrderItems.quantity,
        unitPrice: salesOrderItems.unitPrice,
        totalPrice: salesOrderItems.totalPrice,
        status: salesOrders.status,
        paymentStatus: salesOrders.paymentStatus,
        deliveryDate: salesOrders.deliveryDate,
      })
      .from(salesOrderItems)
      // LEFT JOIN instead of INNER JOIN: don't crash if order is missing
      .leftJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(eq(salesOrderItems.batchId, batchId));
    } catch (err) {
      // Sales traceability is optional – log and continue, never 500
      this.logger.warn(`[FORENSICS] Sales traceability unavailable for batch ${batchId}. ` +
        `This is expected if batch is not linked to any sales order. Error: ${err?.message}`);
    }

    // ── 10. Operator Sessions on this batch ──────────────────────────────────
    let operatorHistory: any[] = [];
    try {
      operatorHistory = await db.select({
        userId: operatorSessions.userId,
        operatorName: users.name,
        station: operatorSessions.station,
        startTime: operatorSessions.startTime,
        endTime: operatorSessions.endTime,
        endReason: operatorSessions.endReason,
        isActive: operatorSessions.isActive,
      })
      .from(operatorSessions)
      .leftJoin(users, eq(operatorSessions.userId, users.id))
      .where(eq(operatorSessions.batchId, batchId))
      .orderBy(desc(operatorSessions.startTime));
    } catch (err) {
      this.logger.warn(`[FORENSICS] Failed to fetch operator sessions for ${batchId}:`, err);
    }

    // ── 11. Audit Trail (correction history) ─────────────────────────────────
    let auditTrail: any[] = [];
    try {
      auditTrail = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        actor: users.name,
        actorId: users.id,
        role: users.jobTitle,
        payload: auditLogs.payload,
        occurredAt: auditLogs.occurredAt,
        category: auditLogs.category,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(
        or(
          eq(auditLogs.entityId, batchId),
          logIds.length > 0
            ? inArray(auditLogs.entityId, logIds)
            : sql`false`   // safe fallback – avoids invalid SQL when logIds is empty
        )
      )
      .orderBy(desc(auditLogs.occurredAt));
    } catch (err) {
      this.logger.error(`[FORENSICS] Failed to fetch audit trail for ${batchId}:`, err);
    }

    // ── RBAC MASKING ────────────────────────────────────────────────────────
    if (!isSuperAdmin && !isAdmin) {
      const privilegedRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'ROOT', 'OWNER']));
      
      const privilegedUserIds = privilegedRoles.length > 0 
        ? (await db.select({ userId: userRoles.userId }).from(userRoles).where(inArray(userRoles.roleId, privilegedRoles.map(r => r.id)))).map(r => r.userId)
        : [];

      if (privilegedUserIds.length > 0) {
        timeline.forEach(l => { if (privilegedUserIds.includes(l.operatorId)) { l.operator = 'SYSTEM'; l.operatorUsername = 'system'; } });
        qcRecords.forEach(r => { if (privilegedUserIds.includes(r.inspectorId)) { r.userName = 'SYSTEM'; } });
        accountability = accountability.filter(a => !privilegedUserIds.includes(a.userId)); // Hide admin accountability
        operatorHistory.forEach(h => { if (privilegedUserIds.includes(h.userId)) { h.operatorName = 'SYSTEM'; } });
        auditTrail.forEach(a => { if (privilegedUserIds.includes(a.actorId)) { a.actor = 'SYSTEM'; } });
      }
    }

    // ── FORENSIC REPORT ──────────────────────────────────────────────────────
    return {
      metadata: {
        batchId,
        generatedAt: new Date(),
        inspector: 'Enterprise Forensic Engine v2',
        sectionsAvailable: {
          timeline: timeline.length > 0,
          downtimes: downtimes.length > 0,
          materialUsage: materialUsage.length > 0,
          inventoryVariance: inventoryVariance.length > 0,
          qcRecords: qcRecords.length > 0,
          telemetry: telemetry.length > 0,
          accountability: accountability.length > 0,
          salesMapping: salesMapping.length > 0,
          operatorHistory: operatorHistory.length > 0,
          auditTrail: auditTrail.length > 0,
        },
      },
      batch,
      timeline,
      downtimes,
      materialUsage,
      inventoryVariance,
      qcRecords,
      telemetry,
      accountability,
      salesMapping,
      operatorHistory,
      auditTrail,
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
