import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL');
        
        if (!url || url === 'undefined') {
           return {
             connection: { host: 'disabled', port: 6379, offlineQueue: false }
           };
        }

        // CORRECT WAY TO PASS URL TO BULLMQ: use an ioredis connection directly
        const connection = new Redis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          connectTimeout: 5000,
          enableOfflineQueue: false,
          tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
          retryStrategy: (times) => Math.min(times * 500, 30000),
        });

        connection.on('error', (err) => {
          // Gracefully suppress connection errors to prevent console spam
        });

        return { connection };
      },
    }),
    BullModule.registerQueue({ 
      name: 'telemetry',
      defaultJobOptions: { 
        removeOnComplete: true,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnFail: { age: 24 * 3600 }
      },
      ...({ skipConfigCheck: true } as any) // Suppresses the "Eviction policy" warning
    }),
  ],
  exports: [BullModule],
})
export class QueueModule { }
