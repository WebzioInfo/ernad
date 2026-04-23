import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { db } from '../db/db';
import { sql } from 'drizzle-orm';
import * as os from 'os';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @ApiOperation({ summary: 'Check system health, database connection, and resource usage' })
  @ApiResponse({ status: 200, description: 'Health status of the system' })
  async checkHealth() {
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        message: '',
      },
      resources: {
        memory: {
          total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
          used_percent: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)}%`,
        },
        uptime: `${(os.uptime() / 60 / 60).toFixed(2)} hours`,
        platform: os.platform(),
      },
    };

    // Check Database connection
    try {
      await db.execute(sql`SELECT 1`);
      healthStatus.database.connected = true;
      healthStatus.database.message = 'Database connection established';
    } catch (error) {
      healthStatus.status = 'DEGRADED';
      healthStatus.database.connected = false;
      healthStatus.database.message = `Database connection failed: ${(error as Error).message}`;
      this.logger.error(`Health check failed: ${healthStatus.database.message}`);
    }

    // Checking RMS (assuming Redis / RAM) - RAM is already included. 
    // If Redis is configured, we could check it here.

    return healthStatus;
  }
}
