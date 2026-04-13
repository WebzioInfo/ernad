import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class RedisQueueService {
  private readonly logger = new Logger(RedisQueueService.name);
  public tallySyncQueue: Queue;
  public reportGenQueue: Queue;

  constructor() {
    this.tallySyncQueue = new Queue('tally-sync', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    this.reportGenQueue = new Queue('report-gen', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    });

    this.logger.log('Redis Queues Initialized: tally-sync, report-gen');
  }

  async scheduleTallySync(jobData: any) {
    // Add job to sync from Tally
    await this.tallySyncQueue.add('fetch-tally-inventory', jobData);
    this.logger.log('Scheduled Tally Sync Job.');
  }

  async triggerReportGeneration(batchId: string) {
    // Refresh materialized views via background job
    await this.reportGenQueue.add('refresh-views', { batchId });
    this.logger.log(`Scheduled Report Gen Job for Batch ${batchId}.`);
  }
}
