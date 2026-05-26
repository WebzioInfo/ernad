import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { NonRetryableBusinessError } from '../../../common/errors/non-retryable-business.error';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TelemetryDto } from '../dto/telemetry.dto';
import { RedisService } from '../../../providers/redis/redis.service';
import { OperatorSessionsService } from '../../operator-sessions/operator-sessions.service';
import { ProcessingService } from './processing.service';
import { TerminalService } from '../../production/services/terminal.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Optional() @InjectQueue('telemetry') private readonly telemetryQueue: Queue | null,
    private readonly redisService: RedisService,
    private readonly sessionService: OperatorSessionsService,
    private readonly processingService: ProcessingService,
    private readonly terminalService: TerminalService,
  ) {}
  async createLog(authenticatedUserId: string, dto: TelemetryDto) {
    if (!dto.batchId || !dto.station) {
      throw new NonRetryableBusinessError('Invalid telemetry payload. Batch ID and Station are required.');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dto.batchId)) {
      throw new NonRetryableBusinessError('Invalid Batch ID format. Must be a valid UUID.');
    }
    if (dto.productId && !uuidRegex.test(dto.productId)) {
      throw new NonRetryableBusinessError('Invalid Product ID format.');
    }
    if (dto.brandId && !uuidRegex.test(dto.brandId)) {
      throw new NonRetryableBusinessError('Invalid Brand ID format.');
    }
    if (dto.lineId && !uuidRegex.test(dto.lineId)) {
      throw new NonRetryableBusinessError('Invalid Line ID format.');
    }
    if (dto.shiftId && !uuidRegex.test(dto.shiftId)) {
      throw new NonRetryableBusinessError('Invalid Shift ID format.');
    }

    // Deduplication check: block identical request IDs using Redis locks
    const dedupeKey = `telemetry:fingerprint:${dto.requestId}`;
    if (this.redisService.getAvailability() && dto.requestId) {
      const isDuplicate = await this.redisService.get(dedupeKey);
      if (isDuplicate) {
        throw new NonRetryableBusinessError(`Duplicate request fingerprint detected: ${dto.requestId}`);
      }
      await this.redisService.set(dedupeKey, 'active', 'EX', 600);
    }

    let finalUserId = authenticatedUserId;

    // 1. HYBRID TERMINAL LOGIC: Quick Attribution
    if (dto.operatorId && dto.operatorPin) {
      const operator = await this.terminalService.verifyOperatorForAction(dto.operatorId, dto.operatorPin);
      finalUserId = operator.id;
      this.logger.debug(`[HYBRID] Action attributed to Operator: ${operator.name} via Terminal: ${dto.terminalId}`);
    }

    // 2. Pre-validate using processing service (Validates batch status and shift)
    await this.processingService.preValidateTelemetry(finalUserId, dto);

    const isServerless = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

    // ── Graceful Degradation: If Redis is down, queue is absent, or serverless mode ──
    if (!this.telemetryQueue || !this.redisService.getAvailability() || isServerless) {
      if (isServerless) {
        this.logger.log('Vercel/Serverless detected: Processing telemetry log synchronously (Skip Queue)');
      } else {
        this.logger.warn('Redis offline or queue unavailable: Processing telemetry log synchronously (Direct-to-DB)');
      }
      await this.processingService.handleTelemetryLog(finalUserId, dto);
      return {
        status: 'ACCEPTED',
        requestId: dto.requestId,
        message: 'Processed synchronously due to Redis unavailability.'
      };
    }

    try {
      const job = await this.telemetryQueue.add('log-ingestion', {
        userId: finalUserId,
        dto
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 }, // Keep failed for 24h for audit
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
      await this.processingService.handleTelemetryLog(finalUserId, dto);
      return { status: 'ACCEPTED', requestId: dto.requestId, message: 'Processed synchronously (Queue Error)' };
    }
  }

  async getLogHistory(batchId: string, station: string, operatorView = false) {
    return this.processingService.getLogHistory(batchId, station, 50, operatorView);
  }
}
