import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { ProcessingService } from './services/processing.service';
import { TelemetryDto } from './dto/telemetry.dto';
import { db } from '../../database/db';
import { auditLogs } from '../../database/schema';

@Processor('telemetry')
export class TelemetryProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryProcessor.name);

  constructor(private readonly processingService: ProcessingService) {
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
      this.logger.error(`Failed to process telemetry job ${job.id} (Attempt ${job.attemptsMade + 1}): ${error.message}`);
      
      // If it's a known bad request (Schema/Validation), don't retry endlessly
      if (error instanceof BadRequestException || error.status === 400) {
        this.logger.error(`Critical validation error in job ${job.id}. Marking as failed and auditing.`);
        
        // Log poison job to audit log for investigation
        await db.insert(auditLogs).values({
          action: 'TELEMETRY_POISON_JOB',
          category: 'TELEMETRY',
          entityType: 'JOB',
          entityId: job.id as string,
          payload: { ...job.data, error: error.message },
        }).catch(auditErr => this.logger.error(`Failed to audit poison job: ${auditErr.message}`));
      }
      
      throw error;
    }
  }
}
