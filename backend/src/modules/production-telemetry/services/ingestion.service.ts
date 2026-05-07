import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ProductionTelemetryDto } from '../dto/production-telemetry.dto';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionService } from '../../operator-session/operator-session.service';
import { ProcessingService } from './processing.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Optional() @InjectQueue('telemetry') private readonly telemetryQueue: Queue | null,
    private readonly redisService: RedisService,
    private readonly sessionService: OperatorSessionService,
    private readonly processingService: ProcessingService,
  ) {}

  async createLog(userId: string, dto: ProductionTelemetryDto) {
    if (!dto.batchId || !dto.station || !dto.sessionId) {
      throw new BadRequestException('Invalid telemetry payload. Session ID and Station are required.');
    }

    // 1. Validate Session
    const session = await this.sessionService.getCurrentSession(userId);
    if (!session || session.id !== dto.sessionId) {
      throw new BadRequestException('No active session found for this operator or Session ID mismatch.');
    }

    if (session.station !== dto.station) {
      throw new BadRequestException(`Operator assigned to ${session.station} but logging for ${dto.station}.`);
    }

    if (session.lineId !== dto.lineId) {
      throw new BadRequestException('Operator is assigned to a different production line.');
    }

    if (session.batchId && session.batchId !== dto.batchId) {
      throw new BadRequestException('Batch mismatch. Please end session and restart for the new batch.');
    }

    const isServerless = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

    // ── Graceful Degradation: If Redis is down, queue is absent, or serverless mode ──
    if (!this.telemetryQueue || !this.redisService.getAvailability() || isServerless) {
      if (isServerless) {
        this.logger.log('Vercel/Serverless detected: Processing telemetry log synchronously (Skip Queue)');
      } else {
        this.logger.warn('Redis offline or queue unavailable: Processing telemetry log synchronously (Direct-to-DB)');
      }
      await this.processingService.handleTelemetryLog(userId, dto);
      return {
        status: 'ACCEPTED',
        requestId: dto.requestId,
        message: 'Processed synchronously due to Redis unavailability.'
      };
    }

    try {
      const job = await this.telemetryQueue.add('log-ingestion', {
        userId,
        dto
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        jobId: dto.requestId
      });

      this.logger.log(`Telemetry job ${job.id} queued for processing.`);

      return { 
        status: 'ACCEPTED', 
        jobId: job.id, 
        requestId: dto.requestId,
        message: 'Log queued for persistent processing.'
      };
    } catch (err) {
      this.logger.error(`Failed to queue job: ${err.message}. Falling back to sync.`);
      await this.processingService.handleTelemetryLog(userId, dto);
      return { status: 'ACCEPTED', requestId: dto.requestId, message: 'Processed synchronously (Queue Error)' };
    }
  }
}
