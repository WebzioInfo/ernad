import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { ProcessingService } from './services/processing.service';
import { TelemetryDto } from './dto/telemetry.dto';
import { db } from '../../database/db';
import { auditLogs } from '../../database/schema';
import { RedisService } from '../../providers/redis/redis.service';
import { NonRetryableBusinessError } from '../../common/errors/non-retryable-business.error';
import { AuditService } from '../audit/audit.service';

@Processor('telemetry')
export class TelemetryProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryProcessor.name);

  constructor(
    private readonly processingService: ProcessingService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing telemetry job ${job.id}...`);

    const { userId, dto } = job.data as { userId: string; dto: TelemetryDto };

    try {
      // Monitor retry counts to detect poison jobs
      if (job.attemptsMade > 3) {
        this.logger.warn(`Poison Job Warning: Job ${job.id} has failed ${job.attemptsMade} times. Inspecting payload.`);
      }

      // Delegate to service logic
      const result = await this.processingService.handleTelemetryLog(userId, dto);
      
      this.logger.log(`Successfully persisted telemetry for request ${dto.requestId}`);
      return result;
    } catch (error) {
      const isNonRetryable = error instanceof NonRetryableBusinessError;
      const isFlowViolation = error.message.includes('FLOW_VIOLATION');
      const isValidationError = error instanceof BadRequestException || error.status === 400 || error.name === 'ValidationError';
      const isFinalAttempt = job.attemptsMade >= 4;

      // Determine if failure is permanent (non-retryable)
      const isPermanent = isNonRetryable || (isValidationError && !isFlowViolation) || (isFlowViolation && isFinalAttempt);

      if (isPermanent) {
        const errorType = isNonRetryable ? 'NON_RETRYABLE' : 'DEAD_LETTERED';
        this.logger.error(`[${errorType}] Critical permanent validation error in job ${job.id}. Discarding and sending to DLQ. Error: ${error.message}`);
        
        // Log poison job to audit log exactly once using AuditService for deduplication
        await this.auditService.logAction({
          userId,
          action: 'TELEMETRY_POISON_JOB',
          category: 'TELEMETRY',
          entityType: 'JOB',
          entityId: job.id as string,
          requestId: dto.requestId,
          payload: { ...job.data, error: error.message },
        });

        // Push to Dead Letter Queue in Redis
        if (this.redisService.getAvailability()) {
          try {
            await this.redisService.lpush('telemetry:dlq', JSON.stringify({
              jobId: job.id,
              data: job.data,
              error: error.message,
              errorType,
              failedAt: new Date()
            }));
          } catch (dlqErr) {
            this.logger.error(`Failed to push to Redis DLQ: ${dlqErr.message}`);
          }
        }

        // Discard the job to prevent further retries
        try {
          await job.discard();
        } catch (discardErr) {
          this.logger.error(`Failed to discard job ${job.id}: ${discardErr.message}`);
        }
      } else {
        // Transient/Retryable error
        this.logger.warn(`[RETRYABLE] Transient failure processing job ${job.id} (Attempt ${job.attemptsMade + 1}/5). Error: ${error.message}`);
      }
      
      throw error;
    }
  }
}
