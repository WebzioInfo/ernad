import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../../database/db';
import { auditLogs } from '../../database/schema';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    // 1. Skip preflight requests
    if (method === 'OPTIONS') return next.handle();

    // 2. Only log state-changing operations
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isWriteOperation) return next.handle();

    // Skip certain paths like login or very noisy telemetry if needed
    if (url.includes('/auth/login') || url.includes('/analytics')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Run audit logging in the background to avoid blocking the response
        this.recordAuditLog(method, url, body, user).catch(err => {
          this.logger.error(`Failed to record audit log: ${err.message}`);
        });
      }),
    );
  }

  private async recordAuditLog(method: string, url: string, body: any, user: any) {
    try {
      const actionDescription = this.humanizeAction(method, url, body);
      const actorId = user?.sub || user?.id || null;
      const entityType = this.extractEntityType(url);
      const entityId = this.extractEntityId(url);

      await db.insert(auditLogs).values({
        actorId,
        action: actionDescription,
        entityType,
        entityId,
        payload: this.sanitizePayload(body),
        occurredAt: new Date(),
      });
    } catch (err: any) {
      this.logger.error(`[AuditLog] Error inserting into DB: ${err.message}`);
      throw err; // Re-throw to be caught by the recordAuditLog.catch
    }
  }

  private humanizeAction(method: string, url: string, body: any): string {
    const parts = url.split('/').filter(p => p && p !== 'api');
    const entity = parts[0] || 'system';

    switch (method) {
      case 'POST':
        if (url.includes('/users')) return `Created new user account: ${body?.name || 'New Staff'}`;
        if (url.includes('/production-management/batches')) return `Started production for: ${body?.brandName || 'New Batch'}`;
        if (url.includes('/master-data/lines')) return `Added production line: ${body?.name || 'New Line'}`;
        if (url.includes('/inventory')) return `Added new stock items to inventory`;
        return `Created new ${entity} entry`;

      case 'PATCH':
      case 'PUT':
        if (url.includes('/users') && url.includes('toggle-active')) return `Updated system access status for a staff member`;
        if (url.includes('/users') && url.includes('reset-pin')) return `Reset security PIN for a staff member`;
        if (url.includes('/users')) return `Updated profile information for: ${body?.name || 'User'}`;
        if (url.includes('/production-management/batches')) return `Modified production batch settings`;
        if (url.includes('/master-data/lines')) return `Updated configuration for production line`;
        return `Modified ${entity} settings`;

      case 'DELETE':
        if (url.includes('/users')) return `Permanently removed a user account`;
        if (url.includes('/master-data/lines')) return `Removed a production line from the system`;
        return `Deleted ${entity} record`;

      default:
        return `${method} action performed on ${entity}`;
    }
  }

  private extractEntityId(url: string): string | null {
    const parts = url.split('/').filter(p => p && p !== 'api');
    // If the last part looks like a UUID or ID, return it
    const lastPart = parts[parts.length - 1];
    if (lastPart && (lastPart.length > 20 || /^\d+$/.test(lastPart))) {
      return lastPart;
    }
    return null;
  }

  private extractEntityType(url: string): string {
    const parts = url.split('/').filter(p => p && p !== 'api');
    return parts[0] || 'unknown';
  }

  private sanitizePayload(payload: any): any {
    if (!payload) return null;
    const sanitized = { ...payload };
    // Remove sensitive fields
    const sensitive = ['password', 'pin', 'pinCode', 'token'];
    for (const key of sensitive) {
      if (key in sanitized) sanitized[key] = '********';
    }
    return sanitized;
  }
}
