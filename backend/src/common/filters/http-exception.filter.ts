import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP_EXCEPTION');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = 
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: exception.message, error: 'Internal Server Error' };

    // Standard industrial error envelope
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: typeof message === 'string' ? message : (message as any).error || 'Error',
      message: typeof message === 'string' ? message : (message as any).message || message,
      requestId: request.headers['x-request-id'] || 'system',
    };

    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} - Error: ${JSON.stringify(errorResponse)}`);
      if (exception.stack) this.logger.error(exception.stack);
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status} - ${JSON.stringify(errorResponse.message)}`);
    }

    response.status(status).json(errorResponse);
  }
}
