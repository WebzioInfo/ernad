import { Injectable, Logger } from '@nestjs/common';

/**
 * Redis/BullMQ is optional in this architecture.
 * On local dev without Redis, all queue operations are no-ops.
 * On production (Vercel/cloud), set REDIS_URL to enable real queuing.
 */
@Injectable()
export class RedisQueueService {
  private readonly logger = new Logger(RedisQueueService.name);
  private readonly isEnabled: boolean;

  // Lazy-loaded Queue instances — only created if Redis is available
  private _tallySyncQueue: any = null;
  private _reportGenQueue: any = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocal = redisUrl && (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost'));
    
    this.isEnabled = !!redisUrl && !(isProduction && isLocal);

    if (this.isEnabled) {
      this.initQueues();
    } else {
      this.logger.warn('Redis Queue disabled (Local/Unconfigured). Set REDIS_URL to enable.');
    }
  }

  private async initQueues() {
    try {
      const { Queue } = await import('bullmq');
      const redisUrl = process.env.REDIS_URL;
      
      const connection = {
        url: redisUrl,
        tls: redisUrl?.startsWith('rediss://') ? {} : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: null,
      };

      this._tallySyncQueue = new Queue('tally-sync', {
        connection,
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      });

      this._reportGenQueue = new Queue('report-gen', { connection });

      this._tallySyncQueue.on('error', (err: any) => {
        this.logger.warn(`Queue (tally) connection error: ${err.message}`);
      });
      this._reportGenQueue.on('error', (err: any) => {
        this.logger.warn(`Queue (report) connection error: ${err.message}`);
      });

      this.logger.log('🚀 Redis Cloud Queues Initialized.');
    } catch (err: any) {
      this.logger.error(`Queue initialization failed: ${err.message}`);
    }
  }

  async scheduleTallySync(jobData: any) {
    if (!this._tallySyncQueue) {
      this.logger.debug('Queue unavailable — skipping Tally Sync (no Redis)');
      return;
    }
    await this._tallySyncQueue.add('fetch-tally-inventory', jobData);
    this.logger.log('Scheduled Tally Sync Job.');
  }

  async triggerReportGeneration(batchId: string) {
    if (!this._reportGenQueue) {
      this.logger.debug('Queue unavailable — skipping Report Gen (no Redis)');
      return;
    }
    await this._reportGenQueue.add('refresh-views', { batchId });
    this.logger.log(`Scheduled Report Gen Job for Batch ${batchId}.`);
  }
}
