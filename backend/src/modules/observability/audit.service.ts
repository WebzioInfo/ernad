import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { auditLogs } from '../../database/schema';

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
  private readonly logger = new Logger('AuditService');

  async logAction(ctx: AuditContext) {
    try {
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

  /**
   * Logs a forensic correction event with diff snapshot
   */
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
