import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || '127.0.0.1',
          port: configService.get('REDIS_PORT') || 6379,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          offlineQueue: true,
          retryStrategy: (times) => {
            // Log the failure but keep trying slowly
            // if (times % 10 === 0) {
            //   console.warn(`[QueueModule] Redis connection attempt ${times} failed. Telemetry queue will be offline.`);
            // }
            return Math.min(times * 500, 30000); // Max 30s delay
          },
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'telemetry',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
