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
          tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
          retryStrategy: (times) => Math.min(times * 500, 30000),
        });

        return { connection };
      },
    }),
    BullModule.registerQueue({ 
      name: 'telemetry',
      defaultJobOptions: { removeOnComplete: true },
      ...({ skipConfigCheck: true } as any) // Suppresses the "Eviction policy" warning
    }),
  ],
  exports: [BullModule],
})
export class QueueModule { }
