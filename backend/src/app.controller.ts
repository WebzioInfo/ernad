import { Controller, Get, Logger } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { db } from './database/db';
import { sql } from 'drizzle-orm';
import { Public } from './modules/auth/public.decorator';

@ApiExcludeController()
@Controller()
export class AppController {
  private readonly logger = new Logger('HealthCheck');

  @Public()
  @Get()
  root() {
    return {
      status: 'online',
      message: 'Ernad MES API is operational',
      timestamp: new Date().toISOString(),
      docs: '/api/docs'
    };
  }

  @Public()
  @Get('health')
  async getHealth() {
    try {
      // Basic DB connectivity check
      await db.execute(sql`SELECT 1`);
      return {
        status: 'OK',
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
        version: '1.0.0-hardened'
      };
    } catch (err) {
      this.logger.error(`[HEALTH_CHECK_FAILED] Database unreachable: ${err.message}`);
      return {
        status: 'ERROR',
        database: 'DISCONNECTED',
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
