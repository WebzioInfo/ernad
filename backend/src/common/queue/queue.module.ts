import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

const redisIsConfigured = !!(process.env.REDIS_HOST || process.env.REDIS_URL);

@Module({
  imports: redisIsConfigured
    ? [
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
              retryStrategy: (times: number) => Math.min(times * 500, 30000),
            },
          }),
        }),
        BullModule.registerQueue({ name: 'telemetry' }),
      ]
    : [],
  exports: [BullModule],
})
export class QueueModule {}
