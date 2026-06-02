import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// In-memory store for simple idempotency checks.
// For multi-instance, this should be replaced with Redis.
interface CacheEntry {
  status: 'processing' | 'completed' | 'error';
  response?: any;
  error?: any;
  timestamp: number;
}
const idempotencyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60 seconds

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    
    // Only apply to state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next.handle();
    }

    const idempotencyKey = req.headers['x-idempotency-key'];

    // If no key provided, just continue. (Optional: enforce it by throwing)
    if (!idempotencyKey) {
      return next.handle();
    }

    // Clean up old entries periodically
    this.cleanupCache();

    const existingEntry = idempotencyCache.get(idempotencyKey);

    if (existingEntry) {
      if (existingEntry.status === 'processing') {
        return throwError(
          () => new HttpException('Concurrent request in progress', HttpStatus.CONFLICT),
        );
      }
      if (existingEntry.status === 'completed') {
        // Return cached successful response
        return of(existingEntry.response);
      }
      // If previous request failed with an error, allow retry
    }

    // Mark as processing
    idempotencyCache.set(idempotencyKey, {
      status: 'processing',
      timestamp: Date.now(),
    });

    return next.handle().pipe(
      tap((response) => {
        idempotencyCache.set(idempotencyKey, {
          status: 'completed',
          response,
          timestamp: Date.now(),
        });
      }),
      catchError((error) => {
        idempotencyCache.set(idempotencyKey, {
          status: 'error',
          error,
          timestamp: Date.now(),
        });
        return throwError(() => error);
      }),
    );
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of idempotencyCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        idempotencyCache.delete(key);
      }
    }
  }
}
