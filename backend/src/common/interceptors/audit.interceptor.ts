import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    if (method === 'OPTIONS') return next.handle();

    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isWriteOperation) return next.handle();

    if (url.includes('/auth/login') || url.includes('/analytics')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.recordAuditLog(method, url, body, user).catch(err => {
          this.logger.error(`Failed to record automated audit log: ${err.message}`);
        });
      }),
    );
  }

  private async recordAuditLog(method: string, url: string, body: any, user: any) {
    try {
      const actionDescription = this.humanizeAction(method, url, body);
      const entityType = this.extractEntityType(url);
      const entityId = this.extractEntityId(url);
      const category = this.determineCategory(url);

      await this.auditService.logAction({
        userId: user?.sub || user?.id || null,
        action: actionDescription,
        entityType,
        entityId,
        category,
        payload: this.sanitizePayload(body)
      });
    } catch (err: any) {
      this.logger.error(`[AuditInterceptor] Trace failed: ${err.message}`);
    }
  }

  private determineCategory(url: string): any {
    if (url.includes('/auth')) return 'AUTH';
    if (url.includes('/production')) return 'PRODUCTION';
    if (url.includes('/inventory')) return 'INVENTORY';
    if (url.includes('/quality')) return 'QC';
    if (url.includes('/sales')) return 'SALES';
    if (url.includes('/telemetry')) return 'TELEMETRY';
    return 'GENERAL';
  }

  private humanizeAction(method: string, url: string, body: any): string {
    const parts = url.split('/').filter(p => p && p !== 'api');
    const entity = parts[0] || 'system';

    switch (method) {
      case 'POST':
        if (url.includes('/production/start')) return `PRODUCTION_BATCH_START`;
        if (url.includes('/production/close')) return `PRODUCTION_BATCH_CLOSE`;
        if (url.includes('/inventory')) return `INVENTORY_ITEM_ADD`;
        return `CREATE_${entity.toUpperCase()}`;
      case 'PATCH':
      case 'PUT':
        return `UPDATE_${entity.toUpperCase()}`;
      case 'DELETE':
        return `DELETE_${entity.toUpperCase()}`;
      default:
        return `${method}_${entity.toUpperCase()}`;
    }
  }

  private extractEntityId(url: string): string | null {
    const parts = url.split('/').filter(p => p && p !== 'api');
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
    const sensitive = ['password', 'pin', 'pinCode', 'token'];
    for (const key of sensitive) {
      if (key in sanitized) sanitized[key] = '********';
    }
    return sanitized;
  }
}
