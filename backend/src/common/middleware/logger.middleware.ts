import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP_ACTION');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl, body } = request;
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;
      
      const logMessage = `[${method}] ${originalUrl} -> ${statusCode} (${duration}ms)`;
      
      if (statusCode >= 400) {
        this.logger.error(logMessage);
        if (body && typeof body === 'object' && Object.keys(body).length > 0) this.logger.debug(`Payload: ${JSON.stringify(this.sanitize(body))}`);
      } else {
        this.logger.log(logMessage);
        if (body && typeof body === 'object' && Object.keys(body).length > 0) {
          this.logger.debug(`Payload: ${JSON.stringify(this.sanitize(body))}`);
        }
      }
    });

    next();
  }

  private sanitize(body: any) {
    const sanitized = { ...body };
    ['password', 'pin', 'credential'].forEach(key => {
      if (key in sanitized) sanitized[key] = '***';
    });
    return sanitized;
  }
}
