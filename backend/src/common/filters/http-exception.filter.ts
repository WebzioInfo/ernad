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
    } else {
      this.logger.warn(`[CLIENT_FAULT] ${request.method} ${request.url} - ${status} - ${message}`);
    }

    // ── PROFESSIONAL API RESPONSE ──
    response.status(status).json({
      success: false,
      message,
      errorCode,
      ...(process.env.NODE_ENV !== 'production' && { technical: exception.message }),
      timestamp: logData.timestamp,
      path: request.url,
    });
  }
}
