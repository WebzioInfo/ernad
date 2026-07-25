import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorMapper } from '../utils/error-mapper';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GLOBAL_EXCEPTION_FILTER');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorCode = 'INTERNAL_ERROR';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      
      if (typeof res === 'object') {
        message = (res as any).message || message;
        errorCode = (res as any).error || 'HTTP_ERROR';
        details = (res as any).details || null;
      } else {
        message = res;
      }
    } else {
      // ── MASK TECHNICAL ERRORS ──
      // Map database/technical errors to user-safe messages
      const mapped = ErrorMapper.map(exception);
      status = mapped.status;
      message = mapped.message;
      errorCode = mapped.errorCode;
    }

    // ── STRUCTURED LOGGING (Technical details kept here) ──
    const logData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.headers['x-mes-request-id'] || 'system',
      user: (request as any).user?.id || 'anonymous',
      internalMessage: exception.message,
      stack: status >= 500 ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(`[SYSTEM_FAILURE] ${request.method} ${request.url} - ${exception.message}`, exception.stack);
      
      let currentCause = exception.cause;
      let depth = 1;
      while (currentCause && depth <= 5) {
        const msg = currentCause.message || String(currentCause);
        this.logger.error(`[SYSTEM_FAILURE_CAUSE depth=${depth}] ${msg}`);
        
        if (currentCause.code || currentCause.severity || currentCause.severity_local || currentCause.detail || currentCause.hint) {
          const code = currentCause.code || 'N/A';
          const severity = currentCause.severity_local || currentCause.severity || 'N/A';
          const detail = currentCause.detail || 'N/A';
          const hint = currentCause.hint || 'N/A';
          this.logger.error(`[SYSTEM_FAILURE_CAUSE_METADATA depth=${depth}] code: ${code} | severity: ${severity} | detail: ${detail} | hint: ${hint}`);
        }
        
        if (currentCause.stack) {
          this.logger.error(`[SYSTEM_FAILURE_CAUSE_STACK depth=${depth}]`, currentCause.stack);
        }
        
        currentCause = currentCause.cause;
        depth++;
      }
    } else {
      this.logger.warn(`[CLIENT_FAULT] ${request.method} ${request.url} - ${status} - ${message}`);
    }

    // ── ENTERPRISE CORS FAIL-SAFE ──
    const origin = request.headers.origin;
    if (origin) {
      // In production, we reflect the origin to satisfy withCredentials: true
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] || 'Content-Type, Authorization, Accept, Origin, X-Requested-With, x-mes-request-id');
      response.setHeader('Vary', 'Origin');
    }

    // ── PROFESSIONAL API RESPONSE ──
    response.status(status).json({
      success: false,
      message,
      errorCode,
      ...(process.env.NODE_ENV !== 'production' && { 
        technical: exception.message,
        actualError: exception.message,
        stack: exception.stack
      }),
      timestamp: logData.timestamp,
      path: request.url,
    });
  }
}
