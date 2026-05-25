import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { auditLogs, users, roles, userRoles } from '../../database/schema';
import { eq, desc, and, gte, lte, inArray, notInArray } from 'drizzle-orm';

export interface AuditContext {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  category: 'AUTH' | 'PRODUCTION' | 'TELEMETRY' | 'INVENTORY' | 'QC' | 'SALES' | 'SECURITY' | 'GENERAL';
  payload?: any;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  private static readonly PRIVILEGED_ROLES = [
    'SUPER_ADMIN',
    'SUPERADMIN',
    'ADMIN',
    'SYSTEM_ADMIN',
    'ROOT',
    'OWNER',
  ];

  async getLogs(filters: { category?: string; actorId?: string; startDate?: Date; endDate?: Date }, callerRoles: string[] = []) {
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');

    const conditions = [];
    
    if (filters.category) conditions.push(eq(auditLogs.category, filters.category));
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters.startDate) conditions.push(gte(auditLogs.occurredAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(auditLogs.occurredAt, filters.endDate));

    // RBAC: Filter out logs of privileged accounts if caller is not an admin
    if (!isSuperAdmin && !isAdmin) {
      const privilegedRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, AuditService.PRIVILEGED_ROLES));
      
      if (privilegedRoles.length > 0) {
        const privilegedUserRoles = await db
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(inArray(userRoles.roleId, privilegedRoles.map(r => r.id)));
        
        const excludedUserIds = privilegedUserRoles.map(pur => pur.userId);
        if (excludedUserIds.length > 0) {
          conditions.push(notInArray(auditLogs.actorId, excludedUserIds));
        }
      }
    }

    return await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      category: auditLogs.category,
      payload: auditLogs.payload,
      occurredAt: auditLogs.occurredAt,
      actor: {
        id: users.id,
        name: users.name,
        username: users.username
      }
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.occurredAt))
    .limit(100);
  }

  async logAction(ctx: AuditContext) {
    try {
      if (ctx.requestId) {
        const [existing] = await db.select()
          .from(auditLogs)
          .where(and(
            eq(auditLogs.requestId, ctx.requestId),
            eq(auditLogs.action, ctx.action)
          ))
          .limit(1);
        if (existing) {
          this.logger.debug(`[AUDIT] Duplicate audit log prevented for requestId: ${ctx.requestId}, action: ${ctx.action}`);
          return;
        }
      }

      await db.insert(auditLogs).values({
        actorId: ctx.userId,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        category: ctx.category,
        requestId: ctx.requestId,
        payload: ctx.payload,
      });

      this.logger.log(`[AUDIT] ${ctx.category}: ${ctx.action} by User ${ctx.userId || 'SYSTEM'} ${ctx.requestId ? `(Req: ${ctx.requestId})` : ''}`);
    } catch (err: any) {
      this.logger.error(`Failed to log audit action: ${err.message}`);
    }
  }

  async logCorrection(userId: string, entity: string, id: string, oldData: any, newData: any, reason: string, requestId?: string) {
    await this.logAction({
      userId,
      action: 'DATA_CORRECTION',
      entityType: entity,
      entityId: id,
      category: 'PRODUCTION',
      requestId,
      payload: {
        reason,
        diff: {
          before: oldData,
          after: newData
        }
      }
    });
  }

  async logSecurity(event: string, details: any, userId?: string) {
    await this.logAction({
      userId,
      action: event,
      category: 'SECURITY',
      payload: details
    });
  }
}
