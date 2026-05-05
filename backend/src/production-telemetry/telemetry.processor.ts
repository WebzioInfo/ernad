import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ProductionTelemetryService } from './production-telemetry.service';
import { ProductionTelemetryDto } from './dto/production-telemetry.dto';

@Processor('telemetry')
export class TelemetryProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryProcessor.name);

  constructor(private readonly telemetryService: ProductionTelemetryService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing telemetry job ${job.id}...`);

    const { userId, dto } = job.data as { userId: string; dto: ProductionTelemetryDto };

    try {
      // Delegate to service logic
      const result = await this.telemetryService.handleTelemetryLog(userId, dto);
      
      this.logger.log(`Successfully persisted telemetry for request ${dto.requestId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process telemetry job ${job.id}: ${error.message}`);
      // Throwing error here will trigger BullMQ retry logic based on 'attempts' config
      throw error;
    }
  }
}
