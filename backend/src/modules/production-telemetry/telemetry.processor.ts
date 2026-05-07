import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ProcessingService } from './services/processing.service';
import { ProductionTelemetryDto } from './dto/production-telemetry.dto';

@Processor('telemetry')
export class TelemetryProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryProcessor.name);

  constructor(private readonly processingService: ProcessingService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing telemetry job ${job.id}...`);

    const { userId, dto } = job.data as { userId: string; dto: ProductionTelemetryDto };

    try {
      // Delegate to service logic
      const result = await this.processingService.handleTelemetryLog(userId, dto);
      
      this.logger.log(`Successfully persisted telemetry for request ${dto.requestId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process telemetry job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
