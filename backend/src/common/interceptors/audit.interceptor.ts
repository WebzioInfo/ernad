import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { db } from '../../db/db';
import { auditLogs } from '../../db/schema';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, body, params } = request;
    
    return next.handle().pipe(
      tap(async (data) => {
        // Only log non-GET requests to the audit trail
        if (method !== 'GET' && user) {
          try {
            await db.insert(auditLogs).values({
              actorId: user.id,
              action: `${method} ${url}`,
              entityType: url.split('/')[2] || 'unknown',
              entityId: params.id || (body.id ? String(body.id) : null),
              payload: body,
              occurredAt: new Date(),
            });
          } catch (err) {
            console.error('[AUDIT_ERROR]', err);
          }
        }
      }),
    );
  }
}
